// /giphy <query> — reference plugin. Asks our server for a random gif and
// posts it as a message with payload { type: 'giphy', ... }. The server
// holds the Giphy API key (set via GIPHY_API_KEY env), proxies the call,
// and returns just the bits we need. The browser never sees the key.
//
// A matching payload renderer (GiphyBlock) is registered alongside so the
// stored payload round-trips back into the same rendered preview for every
// other client.

import {
  api,
  APIError,
  registerSlashCommand,
  registerPayloadRenderer,
  type SlashCommand,
  type PayloadRenderer,
} from '@stack/client'

type GiphyPayload = {
  type: 'giphy'
  url: string
  width: number
  height: number
  title?: string
  // Search term that produced this gif. Surfaced in the UI as a small
  // caption so the reader knows what was searched for.
  query: string
}

// Server response from GET /v1/integrations/giphy/random?q=<query>.
// Shape mirrors GiphyPayload minus the `type` discriminant.
type GiphyRandomResponse = {
  url: string
  width: number
  height: number
  title?: string
  query: string
}

const giphyCommand: SlashCommand = {
  name: 'giphy',
  description: 'Send a random GIF',
  usage: '<query>',
  async run(args) {
    const query = args.trim()
    if (!query) return null
    try {
      const data = await api.get<GiphyRandomResponse>(
        `/v1/integrations/giphy/random?q=${encodeURIComponent(query)}`,
      )
      if (!data?.url) {
        return { text: `/giphy ${query} — no results` }
      }
      const payload: GiphyPayload = {
        type: 'giphy',
        url: data.url,
        width: data.width || 0,
        height: data.height || 0,
        title: data.title,
        query,
      }
      return {
        // Plain-text fallback so search / notifications / accessibility have
        // something readable even before the renderer mounts.
        text: `/giphy ${query}`,
        payload,
      }
    } catch (err) {
      if (err instanceof APIError) {
        // 204 → empty body → request() returns undefined → caught above as
        // !data?.url. Real APIErrors here mean 503 (key not configured),
        // 502 (upstream failure), or 400 (bad query). Surface the title so
        // the user knows what to fix.
        if (err.status === 503) {
          return {
            text:
              `/giphy ${query} — Giphy is not configured on this server. ` +
              `Set GIPHY_API_KEY in the api service env to enable.`,
          }
        }
        if (err.status === 502) {
          return { text: `/giphy ${query} — Giphy upstream error, try again.` }
        }
      }
      throw err
    }
  },
}

const GiphyBlock: PayloadRenderer<GiphyPayload> = ({ payload }) => {
  if (!payload?.url) return null
  return (
    <figure className="mt-1 max-w-sm">
      <img
        src={payload.url}
        alt={payload.title ?? payload.query}
        width={payload.width || undefined}
        height={payload.height || undefined}
        loading="lazy"
        className="rounded border border-zinc-800"
      />
      <figcaption className="mt-1 text-[11px] text-zinc-500">
        /giphy {payload.query}
        {payload.title ? ` — ${payload.title}` : ''}
      </figcaption>
    </figure>
  )
}

export function installGiphy(): void {
  registerSlashCommand(giphyCommand)
  registerPayloadRenderer<GiphyPayload>('giphy', GiphyBlock)
}
