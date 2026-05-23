import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { getConfig } from '@switchboard/client'

export type AddTenantValues = {
  server: string
  email: string
  password: string
  tenantSlug: string
}

export type AddTenantProps = {
  onSubmit: (values: AddTenantValues) => void | Promise<void>
  onCancel?: () => void
  defaultServer?: string
  defaultEmail?: string
  defaultTenantSlug?: string
  title?: string
  description?: string
  submitLabel?: string
  isSubmitting?: boolean
  error?: string | null
  showServer?: boolean
  showTenantSlug?: boolean
  tenantSlugRequired?: boolean
  className?: string
}

export function AddTenant({
  onSubmit,
  onCancel,
  defaultServer,
  defaultEmail = '',
  defaultTenantSlug = '',
  title = 'Sign into another tenant',
  description = 'Same email — different tenant slug. Each session is independent.',
  submitLabel = 'Add tenant',
  isSubmitting = false,
  error = null,
  showServer = true,
  showTenantSlug = true,
  tenantSlugRequired = false,
  className = '',
}: AddTenantProps) {
  const initialServer = defaultServer ?? getConfig().baseURL ?? ''
  const [server, setServer] = useState(initialServer)
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [tenantSlug, setTenantSlug] = useState(defaultTenantSlug)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    void onSubmit({
      server: server.trim(),
      email: email.trim(),
      password,
      tenantSlug: tenantSlug.trim(),
    })
  }

  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (!showServer || server.trim().length > 0) &&
    (!tenantSlugRequired || tenantSlug.trim().length > 0)

  return (
    <form
      onSubmit={handleSubmit}
      className={
        'w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur space-y-4 ' +
        className
      }
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          )}
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        )}
      </header>

      {showServer && (
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-400">
            Server
          </span>
          <input
            type="url"
            inputMode="url"
            autoComplete="url"
            required
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="https://chat.example.com"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </label>
      )}

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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-zinc-500 focus:outline-none"
        />
      </label>

      {showTenantSlug && (
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-400">
            Tenant slug{' '}
            {tenantSlugRequired ? (
              <span className="text-zinc-500">(required)</span>
            ) : (
              <span className="text-zinc-500">(required for parent-app tenants)</span>
            )}
          </span>
          <input
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            required={tenantSlugRequired}
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            placeholder="e.g. brokerage-connect — blank = default tenant"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
        </label>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="w-full rounded bg-zinc-100 text-zinc-900 px-3 py-2 font-medium hover:bg-white disabled:opacity-50"
      >
        {isSubmitting ? 'Adding…' : submitLabel}
      </button>
    </form>
  )
}
