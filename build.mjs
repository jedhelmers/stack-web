import esbuild from 'esbuild'
import fs from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { argv, env } from 'node:process'

const watch = argv.includes('--watch')

// Backend the dev server proxies /api/* to. Default assumes `docker compose up api`
// is running and exposes port 8080 on the host.
const API_BACKEND = env.API_BACKEND_URL || 'http://localhost:8080'
const PUBLIC_PORT = parseInt(env.DEV_PORT || '5173', 10)

await fs.mkdir('dist', { recursive: true })

const opts = {
  entryPoints: ['src/main.tsx'],
  outdir: 'dist',
  entryNames: '[name]-[hash]',
  bundle: true,
  format: 'esm',
  target: 'es2020',
  splitting: true,
  minify: !watch,
  sourcemap: true,
  jsx: 'automatic',
  loader: { '.svg': 'file', '.png': 'file', '.jpg': 'file' },
  metafile: true,
  define: {
    'process.env.NODE_ENV': watch ? '"development"' : '"production"',
  },
  logLevel: 'info',
}

async function writeIndexHtml(meta) {
  // Find the hashed main entry to inject into index.html
  const outputs = meta.outputs
  let mainJs = ''
  for (const [path, info] of Object.entries(outputs)) {
    if (info.entryPoint === 'src/main.tsx') {
      mainJs = '/' + path.replace(/^dist\//, '')
      break
    }
  }
  const tmpl = await fs.readFile('src/index.html', 'utf8')
  const html = tmpl
    .replace('{{MAIN_JS}}', mainJs)
    .replace('{{MAIN_CSS}}', '/index.css')
  await fs.writeFile('dist/index.html', html)
}

if (watch) {
  // Kick off Tailwind in watch mode alongside esbuild so dist/index.css stays fresh.
  const tw = spawn(
    'npx',
    ['tailwindcss', '-i', 'src/index.css', '-o', 'dist/index.css', '--watch'],
    { stdio: 'inherit' },
  )
  tw.on('error', (err) => console.error('tailwind watcher failed to start:', err.message))

  const ctx = await esbuild.context({
    ...opts,
    plugins: [
      {
        name: 'rewrite-index',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.metafile) await writeIndexHtml(result.metafile)
          })
        },
      },
    ],
  })
  await ctx.watch()

  // esbuild serves on a private port; we wrap with our own HTTP server that
  // proxies /api/* to the backend and forwards everything else to esbuild.
  const esb = await ctx.serve({
    servedir: 'dist',
    host: '127.0.0.1',
    port: 0, // any free port
    fallback: 'dist/index.html',
  })

  const apiURL = new URL(API_BACKEND)
  const apiHost = apiURL.hostname
  const apiPort = parseInt(apiURL.port || (apiURL.protocol === 'https:' ? '443' : '80'), 10)

  const server = http.createServer((req, res) => {
    const isAPI = req.url.startsWith('/api/') || req.url === '/api'
    const target = isAPI
      ? {
          hostname: apiHost,
          port: apiPort,
          path: req.url.replace(/^\/api/, ''),
        }
      : { hostname: esb.host, port: esb.port, path: req.url }

    const proxyReq = http.request(
      {
        ...target,
        method: req.method,
        headers: { ...req.headers, host: `${target.hostname}:${target.port}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
        proxyRes.pipe(res)
      },
    )
    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'text/plain' })
      res.end(`proxy error (${isAPI ? 'api' : 'esbuild'}): ${err.message}\n`)
    })
    req.pipe(proxyReq)
  })

  // WebSocket upgrade — only /api/* paths get forwarded to the backend.
  // (esbuild's serve doesn't use WS in our setup, so non-api upgrades are dropped.)
  server.on('upgrade', (req, clientSocket, head) => {
    if (!(req.url || '').startsWith('/api/')) {
      clientSocket.destroy()
      return
    }
    const backendPath = req.url.replace(/^\/api/, '')
    const backend = net.connect(apiPort, apiHost, () => {
      // Replay the original HTTP/1.1 upgrade request to the backend.
      const headers = Object.entries(req.headers)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\r\n')
      backend.write(
        `GET ${backendPath} HTTP/1.1\r\nHost: ${apiHost}:${apiPort}\r\n${headers}\r\n\r\n`,
      )
      if (head && head.length) backend.write(head)
      clientSocket.pipe(backend).pipe(clientSocket)
    })
    backend.on('error', (err) => {
      console.error('ws proxy backend error:', err.message)
      clientSocket.destroy()
    })
    clientSocket.on('error', () => backend.destroy())
  })

  server.listen(PUBLIC_PORT, () => {
    console.log(`dev server: http://localhost:${PUBLIC_PORT}`)
    console.log(`  proxying /api/* (http+ws) -> ${API_BACKEND}`)
  })
} else {
  const result = await esbuild.build(opts)
  await writeIndexHtml(result.metafile)
}
