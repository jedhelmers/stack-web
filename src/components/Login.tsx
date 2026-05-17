import { useState } from 'react'
import { useLogin, APIError } from '@stack/client'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    login.mutate({ email, password })
  }

  const errorMsg =
    login.error instanceof APIError
      ? login.error.detail || login.error.message
      : login.error
        ? String(login.error)
        : null

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur space-y-4"
      >
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Stack</h1>
          <p className="text-sm text-zinc-400">Sign in to continue</p>
        </header>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-400">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-400">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </label>

        {errorMsg && <p className="text-sm text-rose-400">{errorMsg}</p>}

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded bg-zinc-100 text-zinc-900 px-3 py-2 font-medium hover:bg-white disabled:opacity-50"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
