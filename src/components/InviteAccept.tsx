import { useState } from 'react'
import { useAcceptInvite } from '../api/hooks'
import { APIError } from '../api/client'

export function InviteAccept({
  token,
  onAccepted,
}: {
  token: string
  onAccepted: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const accept = useAcceptInvite()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    accept.mutate(
      {
        token,
        email: email.trim(),
        password,
        display_name: displayName.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        locale: navigator.language || 'en',
      },
      { onSuccess: () => onAccepted() },
    )
  }

  const errorMsg =
    accept.error instanceof APIError
      ? accept.error.detail || accept.error.message
      : accept.error
        ? String(accept.error)
        : null

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur space-y-4"
      >
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            You're invited
          </h1>
          <p className="text-sm text-zinc-400">
            Create your account to join the workspace.
          </p>
        </header>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-400">
            Display name
          </span>
          <input
            autoComplete="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-400">
            Email
          </span>
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
          <span className="text-xs uppercase tracking-wider text-zinc-400">
            Password
          </span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
          <span className="mt-1 block text-xs text-zinc-500">At least 8 characters.</span>
        </label>

        {errorMsg && <p className="text-sm text-rose-400">{errorMsg}</p>}

        <button
          type="submit"
          disabled={accept.isPending}
          className="w-full rounded bg-zinc-100 text-zinc-900 px-3 py-2 font-medium hover:bg-white disabled:opacity-50"
        >
          {accept.isPending ? 'Creating account…' : 'Accept invite'}
        </button>
      </form>
    </main>
  )
}
