import { useState } from 'react'
import {
  useHealth,
  useLogout,
  useOperatorAPIKeys,
  useOperatorApps,
  useOperatorAudit,
  useOperatorChannels,
  useOperatorDMs,
  useOperatorStats,
  useOperatorUsers,
  useOperatorWorkspaces,
  useOpCreateAPIKey,
  useOpCreateApp,
  useOpCreateUser,
  useOpCreateWorkspace,
  useOpDeleteUser,
  useOpDeleteWorkspace,
  useOpForceLogoutUser,
  useOpLockUser,
  useOpRevokeAPIKey,
  useOpSuspendWorkspace,
  useOpUnlockUser,
  useOpUnsuspendWorkspace,
} from '@stack/client'
import type {
  OperatorAPIKey,
  OperatorApp,
  OperatorAuditEntry,
  OperatorChannel,
  OperatorDM,
  OperatorUser,
  OperatorWorkspace,
  User,
} from '@stack/client'

type Tab =
  | 'stats'
  | 'workspaces'
  | 'channels'
  | 'dms'
  | 'users'
  | 'apps'
  | 'audit'
  | 'health'

const ALL_TABS: Tab[] = [
  'stats',
  'workspaces',
  'channels',
  'dms',
  'users',
  'apps',
  'audit',
  'health',
]

export function Dashboard({
  user,
  activeTab,
  onTabChange,
  onExit,
}: {
  user: User
  activeTab?: Tab
  onTabChange?: (tab: Tab) => void
  onExit: () => void
}) {
  // Allow controlled (router-driven) or uncontrolled use.
  const [internalTab, setInternalTab] = useState<Tab>('stats')
  const tab: Tab = activeTab && ALL_TABS.includes(activeTab) ? activeTab : internalTab
  const setTab = (t: Tab) => {
    if (onTabChange) onTabChange(t)
    else setInternalTab(t)
  }
  const logout = useLogout()

  return (
    <div className="grid h-screen grid-cols-[220px_1fr] bg-zinc-950 text-zinc-100">
      <aside className="flex flex-col border-r border-zinc-800 bg-zinc-900/50">
        <header className="px-4 py-3 border-b border-zinc-800">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Operator</div>
          <div className="text-sm font-semibold mt-1">Dashboard</div>
        </header>

        <nav className="flex-1 py-2">
          <NavItem active={tab === 'stats'} onClick={() => setTab('stats')}>Stats</NavItem>
          <NavItem active={tab === 'workspaces'} onClick={() => setTab('workspaces')}>Workspaces</NavItem>
          <NavItem active={tab === 'channels'} onClick={() => setTab('channels')}>Channels</NavItem>
          <NavItem active={tab === 'dms'} onClick={() => setTab('dms')}>Direct messages</NavItem>
          <NavItem active={tab === 'users'} onClick={() => setTab('users')}>Users</NavItem>
          <NavItem active={tab === 'apps'} onClick={() => setTab('apps')}>Parent apps</NavItem>
          <NavItem active={tab === 'audit'} onClick={() => setTab('audit')}>Audit log</NavItem>
          <NavItem active={tab === 'health'} onClick={() => setTab('health')}>System health</NavItem>
        </nav>

        <footer className="border-t border-zinc-800 px-4 py-3 text-sm space-y-2">
          <button
            onClick={onExit}
            className="w-full text-xs text-zinc-300 hover:text-zinc-100 text-left"
          >
            ← Back to chat
          </button>
          <div className="pt-1 border-t border-zinc-800">
            <div className="text-zinc-300 mt-2">{user.display_name}</div>
            <div className="text-xs text-zinc-500 truncate">{user.email}</div>
            <button
              onClick={() => logout.mutate()}
              className="mt-2 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Sign out
            </button>
          </div>
        </footer>
      </aside>

      <section className="overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {tab === 'stats' && <StatsView />}
          {tab === 'workspaces' && <WorkspacesView />}
          {tab === 'channels' && <ChannelsView />}
          {tab === 'dms' && <DMsView />}
          {tab === 'users' && <UsersView />}
          {tab === 'apps' && <AppsView />}
          {tab === 'audit' && <AuditView />}
          {tab === 'health' && <HealthView />}
        </div>
      </section>
    </div>
  )
}

function NavItem({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        'block w-full text-left px-4 py-1.5 text-sm transition-colors ' +
        (active
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200')
      }
    >
      {children}
    </button>
  )
}

// ---- Stats -----------------------------------------------------------------

function StatsView() {
  const { data, isLoading, error } = useOperatorStats()
  if (isLoading) return <Loading />
  if (error) return <ErrorMsg message={String(error)} />
  if (!data) return null
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Usage</h1>

      <Section title="People">
        <StatCard label="Total users" value={data.users} />
        <StatCard label="Operators" value={data.operators} />
        <StatCard label="Active (7d)" value={data.active_users_7d} />
      </Section>

      <Section title="Spaces">
        <StatCard label="Workspaces" value={data.workspaces} />
        <StatCard label="Public channels" value={data.public_channels} />
        <StatCard label="Private channels" value={data.private_channels} />
        <StatCard label="DMs / group DMs" value={data.dms} />
      </Section>

      <Section title="Activity">
        <StatCard label="Total messages" value={data.messages} />
        <StatCard label="Messages (24h)" value={data.messages_24h} />
        <StatCard label="Pending invites" value={data.pending_invites} />
      </Section>

      <p className="text-xs text-zinc-500">Refreshes every 5 seconds.</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">{title}</h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">{children}</div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value.toLocaleString()}</div>
    </div>
  )
}

// ---- Workspaces ------------------------------------------------------------

function WorkspacesView() {
  const [q, setQ] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading, error } = useOperatorWorkspaces(q)
  const suspend = useOpSuspendWorkspace()
  const unsuspend = useOpUnsuspendWorkspace()
  const del = useOpDeleteWorkspace()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Header title="Workspaces" />
        <button
          onClick={() => setShowCreate(true)}
          className="rounded bg-zinc-100 text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-white"
        >
          + New workspace
        </button>
      </div>
      <SearchInput value={q} onChange={setQ} placeholder="Search by slug or name…" />
      {isLoading ? <Loading /> : error ? <ErrorMsg message={String(error)} /> : (
        <Table
          columns={['Slug', 'Name', 'Members', 'Channels', 'Messages', 'Last activity', 'Status', 'Actions']}
          rows={(data ?? []).map((w: OperatorWorkspace) => [
            <Mono>{w.slug}</Mono>,
            w.name,
            w.member_count.toLocaleString(),
            w.channel_count.toLocaleString(),
            w.message_count.toLocaleString(),
            <RelTime ts={w.last_message_at} />,
            <StatusPill status={w.status} />,
            <RowActions>
              {w.status === 'active' ? (
                <RowButton
                  onClick={() => suspend.mutate(w.id)}
                  variant="warn"
                  disabled={suspend.isPending}
                >
                  Suspend
                </RowButton>
              ) : w.status === 'suspended' ? (
                <RowButton
                  onClick={() => unsuspend.mutate(w.id)}
                  disabled={unsuspend.isPending}
                >
                  Unsuspend
                </RowButton>
              ) : null}
              <RowButton
                onClick={() => {
                  if (confirm(`Delete workspace "${w.slug}"? This is a soft delete.`)) {
                    del.mutate(w.id)
                  }
                }}
                variant="danger"
                disabled={del.isPending}
              >
                Delete
              </RowButton>
            </RowActions>,
          ])}
          emptyText={q ? 'No workspaces match.' : 'No workspaces yet.'}
        />
      )}
      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [ownerUserID, setOwnerUserID] = useState('')
  const [description, setDescription] = useState('')
  const create = useOpCreateWorkspace()

  return (
    <Modal onClose={onClose} title="Create workspace">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { slug, name, owner_user_id: ownerUserID, description: description || undefined },
            { onSuccess: () => onClose() },
          )
        }}
        className="space-y-3"
      >
        <Field label="Slug" hint="3-64 chars, lowercase letters/digits/hyphens">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            required
            className={modalInputClass}
          />
        </Field>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required className={modalInputClass} />
        </Field>
        <Field label="Owner user ID" hint="UUID of the user who will own this workspace">
          <input
            value={ownerUserID}
            onChange={(e) => setOwnerUserID(e.target.value)}
            required
            placeholder="00000000-0000-0000-0000-000000000000"
            className={modalInputClass + ' font-mono text-xs'}
          />
        </Field>
        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={modalInputClass}
          />
        </Field>
        {create.error && <p className="text-sm text-rose-400">{String(create.error)}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-zinc-100 text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-white disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Users -----------------------------------------------------------------

function UsersView() {
  const [q, setQ] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading, error } = useOperatorUsers(q)
  const lock = useOpLockUser()
  const unlock = useOpUnlockUser()
  const forceLogout = useOpForceLogoutUser()
  const del = useOpDeleteUser()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Header title="Users" />
        <button
          onClick={() => setShowCreate(true)}
          className="rounded bg-zinc-100 text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-white"
        >
          + New user
        </button>
      </div>
      <SearchInput value={q} onChange={setQ} placeholder="Search by email or display name…" />
      {isLoading ? <Loading /> : error ? <ErrorMsg message={String(error)} /> : (
        <Table
          columns={['Email', 'Name', 'Role', 'Workspaces', 'Owns', 'Last login', 'Status', 'Actions']}
          rows={(data ?? []).map((u: OperatorUser) => [
            <Mono>{u.email}</Mono>,
            u.display_name,
            u.is_operator ? <span className="text-amber-400 text-xs">operator</span> : <span className="text-zinc-500 text-xs">user</span>,
            u.workspace_count.toLocaleString(),
            u.owned_workspace_count.toLocaleString(),
            <RelTime ts={u.last_login_at} />,
            <StatusPill status={u.status} />,
            <RowActions>
              {u.status === 'active' ? (
                <RowButton onClick={() => lock.mutate(u.id)} variant="warn" disabled={lock.isPending}>Lock</RowButton>
              ) : (
                <RowButton onClick={() => unlock.mutate(u.id)} disabled={unlock.isPending}>Unlock</RowButton>
              )}
              <RowButton
                onClick={() => {
                  if (confirm(`Force logout all sessions for ${u.email}?`)) {
                    forceLogout.mutate(u.id, {
                      onSuccess: (resp) => {
                        if (resp && typeof resp === 'object' && 'revoked' in resp) {
                          alert(`Revoked ${(resp as { revoked: number }).revoked} session(s).`)
                        }
                      },
                    })
                  }
                }}
                disabled={forceLogout.isPending}
              >
                Force logout
              </RowButton>
              <RowButton
                onClick={() => {
                  if (u.owned_workspace_count > 0) {
                    alert(`Cannot delete: user owns ${u.owned_workspace_count} workspace(s). Transfer ownership first.`)
                    return
                  }
                  if (confirm(`Permanently delete ${u.email}? This cannot be undone.`)) {
                    del.mutate(u.id)
                  }
                }}
                variant="danger"
                disabled={del.isPending}
              >
                Delete
              </RowButton>
            </RowActions>,
          ])}
          emptyText={q ? 'No users match.' : 'No users yet.'}
        />
      )}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [isOperator, setIsOperator] = useState(false)
  const create = useOpCreateUser()

  return (
    <Modal onClose={onClose} title="Create user">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { email, display_name: displayName, password, is_operator: isOperator },
            { onSuccess: () => onClose() },
          )
        }}
        className="space-y-3"
      >
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={modalInputClass}
          />
        </Field>
        <Field label="Display name">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className={modalInputClass}
          />
        </Field>
        <Field label="Password" hint="Min 8 chars; user can change after first login">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={modalInputClass}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={isOperator}
            onChange={(e) => setIsOperator(e.target.checked)}
          />
          Grant operator role
        </label>
        {create.error && <p className="text-sm text-rose-400">{String(create.error)}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-zinc-100 text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-white disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Channels --------------------------------------------------------------

function ChannelsView() {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'' | 'public' | 'private'>('')
  const { data, isLoading, error } = useOperatorChannels(q, kind)
  return (
    <div className="space-y-4">
      <Header title="Channels" />
      <div className="flex gap-2 items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search by channel slug, name, or workspace…" />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as '' | 'public' | 'private')}
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm"
        >
          <option value="">All kinds</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>
      {isLoading ? <Loading /> : error ? <ErrorMsg message={String(error)} /> : (
        <Table
          columns={['Workspace', 'Channel', 'Kind', 'Members', 'Messages', 'Last activity', '']}
          rows={(data ?? []).map((c: OperatorChannel) => [
            <Mono>{c.workspace_slug}</Mono>,
            <span>
              <span className="text-zinc-500">#</span>
              {c.slug ?? '(unnamed)'}
            </span>,
            <KindPill kind={c.kind} />,
            c.member_count.toLocaleString(),
            c.message_count.toLocaleString(),
            <RelTime ts={c.last_message_at} />,
            c.archived ? <span className="text-xs text-zinc-500">archived</span> : '',
          ])}
          emptyText={q ? 'No channels match.' : 'No channels yet.'}
        />
      )}
    </div>
  )
}

// ---- DMs (metadata only) ---------------------------------------------------

function DMsView() {
  const [q, setQ] = useState('')
  const { data, isLoading, error } = useOperatorDMs(q)
  return (
    <div className="space-y-4">
      <Header title="Direct messages" />
      <p className="text-xs text-zinc-500">
        Metadata only. Operators do not have access to DM contents from this view.
      </p>
      <SearchInput value={q} onChange={setQ} placeholder="Search by participant email or name…" />
      {isLoading ? <Loading /> : error ? <ErrorMsg message={String(error)} /> : (
        <Table
          columns={['Workspace', 'Participants', 'Kind', 'Messages', 'Last activity']}
          rows={(data ?? []).map((d: OperatorDM) => [
            <Mono>{d.workspace_slug}</Mono>,
            <Participants names={d.participant_names} emails={d.participant_emails} />,
            <KindPill kind={d.kind} />,
            d.message_count.toLocaleString(),
            <RelTime ts={d.last_message_at} />,
          ])}
          emptyText={q ? 'No conversations match.' : 'No direct messages yet.'}
        />
      )}
    </div>
  )
}

function Participants({ names, emails }: { names: string[]; emails: string[] }) {
  if (!names || names.length === 0) {
    return <span className="text-zinc-500">(none)</span>
  }
  return (
    <span title={emails?.join(', ')}>
      {names.join(', ')}
    </span>
  )
}

// ---- Audit log -------------------------------------------------------------

function AuditView() {
  const [action, setAction] = useState('')
  const [actorID, setActorID] = useState('')
  const { data, isLoading, error } = useOperatorAudit(action, actorID)

  return (
    <div className="space-y-4">
      <Header title="Audit log" />
      <p className="text-xs text-zinc-500">
        Newest first. Records every operator-initiated mutation. Actor email is denormalized
        so the trail survives user deletion.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filter by action (eg. user.lock)"
          className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none w-72"
        />
        <input
          value={actorID}
          onChange={(e) => setActorID(e.target.value)}
          placeholder="Filter by actor user UUID"
          className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none w-96"
        />
        {(action || actorID) && (
          <button
            onClick={() => {
              setAction('')
              setActorID('')
            }}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2"
          >
            Clear
          </button>
        )}
      </div>
      {isLoading ? <Loading /> : error ? <ErrorMsg message={String(error)} /> : (
        <Table
          columns={['When', 'Actor', 'Action', 'Target', 'IP', 'Metadata']}
          rows={(data ?? []).map((e: OperatorAuditEntry) => [
            <RelTime ts={e.created_at} />,
            <span title={e.actor_user_id}>{e.actor_email}</span>,
            <Mono>{e.action}</Mono>,
            <AuditTarget type={e.target_type} id={e.target_id} />,
            e.ip ? <Mono>{e.ip}</Mono> : <span className="text-zinc-500">—</span>,
            <AuditMetadata metadata={e.metadata} />,
          ])}
          emptyText={action || actorID ? 'No entries match.' : 'No audit entries yet.'}
        />
      )}
    </div>
  )
}

function AuditTarget({ type, id }: { type?: string; id?: string }) {
  if (!type && !id) return <span className="text-zinc-500">—</span>
  return (
    <span className="text-xs">
      {type && <span className="text-zinc-400">{type}</span>}
      {type && id && <span className="text-zinc-600"> · </span>}
      {id && <span className="font-mono text-zinc-300" title={id}>{id.slice(0, 8)}…</span>}
    </span>
  )
}

function AuditMetadata({ metadata }: { metadata?: Record<string, unknown> }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <span className="text-zinc-500">—</span>
  }
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200 select-none">
        {Object.keys(metadata).length} field{Object.keys(metadata).length === 1 ? '' : 's'}
      </summary>
      <pre className="mt-1 max-w-md overflow-x-auto rounded bg-zinc-950 p-2 text-zinc-300">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </details>
  )
}

// ---- System health ---------------------------------------------------------

function HealthView() {
  const { data, isLoading, error } = useHealth()
  if (isLoading) return <Loading />
  if (error) return <ErrorMsg message={String(error)} />
  if (!data) return null

  return (
    <div className="space-y-4">
      <Header title="System health" />
      <div className={'rounded-xl border p-4 ' + (data.ok
        ? 'border-emerald-900/50 bg-emerald-950/30'
        : 'border-rose-900/50 bg-rose-950/30')}>
        <div className="font-medium">
          Overall: {data.ok
            ? <span className="text-emerald-400">OK</span>
            : <span className="text-rose-400">DEGRADED</span>}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(data.checks).map(([k, v]) => (
              <tr key={k} className="border-t border-zinc-800 first:border-t-0">
                <td className="px-3 py-2 text-zinc-300">{k}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {v === 'ok'
                    ? <span className="text-emerald-400">{v}</span>
                    : <span className="text-rose-400">{v}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- shared atoms ----------------------------------------------------------

function Header({ title }: { title: string }) {
  return <h1 className="text-2xl font-semibold">{title}</h1>
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-md rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
    />
  )
}

function Table({
  columns,
  rows,
  emptyText,
}: {
  columns: string[]
  rows: React.ReactNode[][]
  emptyText: string
}) {
  if (rows.length === 0) {
    return <div className="rounded border border-zinc-800 p-6 text-sm text-zinc-500">{emptyText}</div>
  }
  return (
    <div className="rounded-xl border border-zinc-800 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/60">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs uppercase tracking-wider text-zinc-500 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-900/40">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top text-zinc-200">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-zinc-300">{children}</span>
}

function KindPill({ kind }: { kind: string }) {
  const color = {
    public: 'text-emerald-400 border-emerald-900/50 bg-emerald-950/30',
    private: 'text-amber-400 border-amber-900/50 bg-amber-950/30',
    dm: 'text-sky-400 border-sky-900/50 bg-sky-950/30',
    group_dm: 'text-violet-400 border-violet-900/50 bg-violet-950/30',
  }[kind] ?? 'text-zinc-400 border-zinc-800 bg-zinc-900'
  return <span className={'inline-block rounded border px-2 py-0.5 text-xs ' + color}>{kind}</span>
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === 'active'
      ? 'text-emerald-400 border-emerald-900/50 bg-emerald-950/30'
      : status === 'suspended'
        ? 'text-amber-400 border-amber-900/50 bg-amber-950/30'
        : 'text-rose-400 border-rose-900/50 bg-rose-950/30'
  return <span className={'inline-block rounded border px-2 py-0.5 text-xs ' + color}>{status}</span>
}

function RelTime({ ts }: { ts?: string }) {
  if (!ts) return <span className="text-zinc-500">—</span>
  const d = new Date(ts)
  const diffMs = Date.now() - d.getTime()
  const sec = Math.round(diffMs / 1000)
  const text =
    sec < 60 ? `${sec}s ago` :
    sec < 3600 ? `${Math.round(sec / 60)}m ago` :
    sec < 86400 ? `${Math.round(sec / 3600)}h ago` :
    `${Math.round(sec / 86400)}d ago`
  return <span title={d.toISOString()}>{text}</span>
}

// ---- Parent apps + API keys -----------------------------------------------

// AppsView is the operator screen for managing parent apps and their API
// keys. Scope-wise it's "just enough to mint a key end-to-end" — no
// allowed_origins editor, no suspend buttons. Those endpoints exist on
// the server; this UI doesn't surface them yet.
function AppsView() {
  const apps = useOperatorApps()
  const [selectedID, setSelectedID] = useState<string | null>(null)

  if (apps.isLoading) return <Loading />
  if (apps.error) return <ErrorMsg message={String(apps.error)} />
  const rows = apps.data ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Parent apps</h1>
      <p className="text-sm text-zinc-400">
        Each parent app is a walled-garden tenant. End users live under exactly
        one app and never see another's workspaces. API keys authenticate the
        parent app's backend when it calls{' '}
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">/v1/auth/sso/exchange</code>.
      </p>

      <CreateAppInline />

      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Origins</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((app) => (
              <tr key={app.id} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2 font-mono text-xs">{app.slug}</td>
                <td className="px-3 py-2">{app.name}</td>
                <td className="px-3 py-2"><StatusPill status={app.status} /></td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {app.allowed_origins.length === 0
                    ? <span className="text-zinc-600">—</span>
                    : app.allowed_origins.join(', ')}
                </td>
                <td className="px-3 py-2 text-right">
                  <RowActions>
                    <RowButton onClick={() => setSelectedID(app.id)}>Manage keys</RowButton>
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-6 text-center text-sm text-zinc-500">
            No parent apps yet — create one above.
          </div>
        )}
      </div>

      {selectedID && (
        <KeysModal
          app={rows.find((a) => a.id === selectedID)!}
          onClose={() => setSelectedID(null)}
        />
      )}
    </div>
  )
}

// CreateAppInline is the "minimal scope" replacement for a separate modal —
// the create form lives on the same screen as the list. Allowed origins is
// a single comma-separated input here; a chip editor can come later when an
// operator actually needs to edit origins post-creation.
function CreateAppInline() {
  const create = useOpCreateApp()
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [origins, setOrigins] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const allowed = origins
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        create.mutate(
          { slug, name, allowed_origins: allowed },
          {
            onSuccess: () => {
              setSlug('')
              setName('')
              setOrigins('')
            },
          },
        )
      }}
      className="rounded border border-zinc-800 bg-zinc-900/40 p-4"
    >
      <div className="mb-3 text-sm font-medium">Register a new parent app</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Slug" hint="3-64 chars, lowercase letters/digits/hyphens">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            required
            className={modalInputClass}
            placeholder="acme-portal"
          />
        </Field>
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={modalInputClass}
            placeholder="Acme Portal"
          />
        </Field>
        <Field
          label="Allowed origins"
          hint="Comma-separated. Wildcards allowed for one host label."
        >
          <input
            value={origins}
            onChange={(e) => setOrigins(e.target.value)}
            className={modalInputClass + ' font-mono text-xs'}
            placeholder="https://app.acme.com, https://*.acme.com"
          />
        </Field>
      </div>
      {create.error && <p className="mt-2 text-sm text-rose-400">{String(create.error)}</p>}
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={create.isPending || !slug || !name}
          className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create app'}
        </button>
      </div>
    </form>
  )
}

// KeysModal shows every key for an app + a mint-new-key form. Plaintext is
// surfaced once via PlaintextReveal and then unreachable.
function KeysModal({ app, onClose }: { app: OperatorApp; onClose: () => void }) {
  const keys = useOperatorAPIKeys(app.id)
  const create = useOpCreateAPIKey(app.id)
  const revoke = useOpRevokeAPIKey(app.id)
  const [label, setLabel] = useState('')
  const [scope, setScope] = useState('sso:exchange')
  const [reveal, setReveal] = useState<string | null>(null)

  return (
    <Modal title={`Keys — ${app.name}`} onClose={onClose}>
      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate(
              { label, scopes: scope.split(',').map((s) => s.trim()).filter(Boolean) },
              {
                onSuccess: (k) => {
                  setReveal(k.plaintext)
                  setLabel('')
                },
              },
            )
          }}
          className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-3"
        >
          <div className="text-xs uppercase tracking-wider text-zinc-500">Mint a new key</div>
          <Field label="Label">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="prod backend"
              required
              className={modalInputClass}
            />
          </Field>
          <Field label="Scopes" hint="Comma-separated. sso:exchange is the only one in use today.">
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className={modalInputClass + ' font-mono text-xs'}
            />
          </Field>
          {create.error && <p className="text-sm text-rose-400">{String(create.error)}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {create.isPending ? 'Minting…' : 'Mint key'}
            </button>
          </div>
        </form>

        {reveal && <PlaintextReveal plaintext={reveal} onDismiss={() => setReveal(null)} />}

        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Existing keys</div>
          {keys.isLoading ? (
            <Loading />
          ) : keys.error ? (
            <ErrorMsg message={String(keys.error)} />
          ) : (
            <KeysList rows={keys.data ?? []} onRevoke={(id) => revoke.mutate(id)} />
          )}
        </div>
      </div>
    </Modal>
  )
}

function KeysList({
  rows,
  onRevoke,
}: {
  rows: OperatorAPIKey[]
  onRevoke: (id: string) => void
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-zinc-500">No keys minted yet.</div>
  }
  return (
    <div className="space-y-2">
      {rows.map((k) => (
        <div
          key={k.id}
          className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <div className="font-mono text-xs text-zinc-300">{k.key_prefix}…</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {k.label || <span className="italic text-zinc-600">no label</span>}
              {' · '}
              {k.scopes.length > 0 ? k.scopes.join(', ') : 'no scopes'}
              {' · last used '}
              <RelTime ts={k.last_used_at} />
            </div>
          </div>
          {k.revoked_at ? (
            <span className="text-xs text-zinc-600">revoked</span>
          ) : (
            <RowButton variant="danger" onClick={() => onRevoke(k.id)}>
              Revoke
            </RowButton>
          )}
        </div>
      ))}
    </div>
  )
}

// PlaintextReveal is the one-time view of a freshly-minted API key. The
// plaintext is held in component state only; closing the panel discards it
// for good. We deliberately do NOT render a "copy + show again" affordance —
// the operator gets one shot to copy, exactly as the server promises.
function PlaintextReveal({
  plaintext,
  onDismiss,
}: {
  plaintext: string
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded border border-amber-900/60 bg-amber-950/30 p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-300">
        Save this key now — it won't be shown again
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 select-all break-all rounded bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-100">
          {plaintext}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(plaintext)
              setCopied(true)
            } catch {
              // Clipboard API requires secure context. Selection fallback
              // works without it.
            }
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded border border-amber-900/60 bg-amber-950/50 px-2 py-1 text-xs text-amber-200 hover:bg-amber-900/40"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function Loading() {
  return <div className="text-sm text-zinc-500">Loading…</div>
}

function ErrorMsg({ message }: { message: string }) {
  return <div className="text-sm text-rose-400">Error: {message}</div>
}

// ---- modal + form atoms ---------------------------------------------------

const modalInputClass =
  'mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>
}

function RowButton({
  children,
  onClick,
  variant = 'default',
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'warn' | 'danger'
  disabled?: boolean
}) {
  const cls =
    variant === 'danger'
      ? 'border-rose-900/50 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
      : variant === 'warn'
        ? 'border-amber-900/50 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40'
        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={'rounded border px-2 py-0.5 text-xs ' + cls + ' disabled:opacity-50'}
    >
      {children}
    </button>
  )
}
