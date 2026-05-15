import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  uploadAttachment,
  useChannels,
  useTypingNotifier,
  useTypingState,
  useCreateChannel,
  useCreateWorkspaceInvite,
  useDMs,
  useJoinChannel,
  useLeaveChannel,
  useLogout,
  useMembers,
  useMessages,
  useMyWorkspaces,
  usePostMessage,
  usePublicChannels,
  useRealtime,
  useRevokeWorkspaceInvite,
  useStartDM,
  useWorkspaceInvites,
} from '../api/hooks'
import type {
  AttachmentFile,
  Channel,
  DMSummary,
  Invite,
  InviteWithToken,
  Member,
  Message,
  User,
} from '../api/client'

type Props = {
  user: User
  // Controlled (router-driven) selection. If absent, falls back to internal state.
  activeWorkspaceSlug?: string | null
  activeChannelId?: string | null
  onSelectWorkspace?: (slug: string) => void
  onSelectChannel?: (slug: string, channelId: string) => void
  onOpenDashboard?: () => void
}

export function Chat({
  user,
  activeWorkspaceSlug = null,
  activeChannelId = null,
  onSelectWorkspace,
  onSelectChannel,
  onOpenDashboard,
}: Props) {
  const { data: workspaces, isLoading: wsLoading, error: wsError } = useMyWorkspaces()
  const [internalSlug, setInternalSlug] = useState<string | null>(null)
  const [internalChannelId, setInternalChannelId] = useState<string | null>(null)
  const [showInvites, setShowInvites] = useState(false)
  // Just-started DMs we haven't yet sent a message in. The server hides them
  // from useDMs (no messages yet) so the recipient doesn't see them; we keep
  // them locally so the initiator can see + select their fresh DM in the
  // sidebar before they post the first message.
  const [pendingDMs, setPendingDMs] = useState<DMSummary[]>([])
  const logout = useLogout()
  const rtState = useRealtime()

  // Resolve effective workspace slug (controlled prop wins).
  const slug = activeWorkspaceSlug ?? internalSlug

  // Auto-select first workspace if nothing in URL or state.
  useEffect(() => {
    if (slug) return
    if (workspaces && workspaces.length > 0) {
      const firstSlug = workspaces[0]!.slug
      if (onSelectWorkspace) onSelectWorkspace(firstSlug)
      else setInternalSlug(firstSlug)
    }
  }, [slug, workspaces, onSelectWorkspace])

  const { data: channels } = useChannels(slug)
  const { data: members } = useMembers(slug)
  const { data: dms } = useDMs(slug)

  // Drop any pendingDM the server now reports — first message just landed.
  useEffect(() => {
    if (!dms || pendingDMs.length === 0) return
    const realIDs = new Set(dms.map((d) => d.id))
    if (pendingDMs.some((p) => realIDs.has(p.id))) {
      setPendingDMs((cur) => cur.filter((p) => !realIDs.has(p.id)))
    }
  }, [dms, pendingDMs])

  // Reset pending DMs when switching workspaces — they're workspace-scoped.
  useEffect(() => {
    setPendingDMs([])
  }, [slug])

  // Resolve effective channel id (controlled prop wins).
  const channelId = activeChannelId ?? internalChannelId

  // Auto-select #general (or first channel) when channels load and nothing selected.
  useEffect(() => {
    if (channelId) return
    if (!slug || !channels || channels.length === 0) return
    const general = channels.find((c) => c.slug === 'general')
    const target = (general ?? channels[0])!.id
    if (onSelectChannel) onSelectChannel(slug, target)
    else setInternalChannelId(target)
  }, [channelId, slug, channels, onSelectChannel])

  // If selected channel disappears from the user's lists (left it, archived,
  // DM removed), clear so auto-select picks a new one.
  useEffect(() => {
    if (!channelId || !channels) return
    const inChannels = channels.find((c) => c.id === channelId)
    const inDMs = (dms ?? []).find((d) => d.id === channelId)
    const inPending = pendingDMs.find((d) => d.id === channelId)
    if (inChannels || inDMs || inPending) return
    if (onSelectChannel && slug && channels.length > 0) {
      const fallback = channels.find((c) => c.slug === 'general') ?? channels[0]!
      onSelectChannel(slug, fallback.id)
    } else {
      setInternalChannelId(null)
    }
  }, [channelId, channels, dms, pendingDMs, slug, onSelectChannel])

  if (wsError) {
    return <FullPageError message={String(wsError)} />
  }
  if (wsLoading) return <FullPageMessage>Loading…</FullPageMessage>
  if (!workspaces || workspaces.length === 0) {
    return (
      <FullPageMessage>
        You don't belong to any workspace yet. Accept an invite or have one created for you.
      </FullPageMessage>
    )
  }

  const namedActive = channels?.find((c) => c.id === channelId) ?? null
  const dmActive =
    (dms ?? []).find((d) => d.id === channelId) ??
    pendingDMs.find((d) => d.id === channelId) ??
    null
  // Synthesize a Channel from a DM for ChannelView. The MessageList just needs
  // the id; the header reads kind + name.
  const activeChannel: (Channel & { dm?: DMSummary }) | null = namedActive
    ? namedActive
    : dmActive
      ? {
          id: dmActive.id,
          workspace_id: '', // unused by ChannelView
          kind: dmActive.kind,
          name: dmLabel(dmActive),
          archived: false,
          dm: dmActive,
        }
      : null
  const myMembership = members?.find((m) => m.user_id === user.id) ?? null
  const isWorkspaceAdmin =
    myMembership?.role === 'owner' || myMembership?.role === 'admin'

  function handleSelectWorkspace(nextSlug: string) {
    if (onSelectWorkspace) onSelectWorkspace(nextSlug)
    else {
      setInternalSlug(nextSlug)
      setInternalChannelId(null)
    }
  }

  function handleSelectChannel(nextChannelId: string) {
    if (onSelectChannel && slug) onSelectChannel(slug, nextChannelId)
    else setInternalChannelId(nextChannelId)
  }

  return (
    <div className="grid h-screen grid-cols-[260px_1fr] overflow-hidden bg-zinc-950 text-zinc-100">
      <aside className="flex flex-col min-h-0 overflow-hidden border-r border-zinc-800 bg-zinc-900/50">
        <header className="px-4 py-3 border-b border-zinc-800 space-y-2">
          <select
            value={slug ?? ''}
            onChange={(e) => handleSelectWorkspace(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.slug}>
                {w.name}
              </option>
            ))}
          </select>
          {isWorkspaceAdmin && slug && (
            <button
              onClick={() => setShowInvites(true)}
              className="w-full text-left text-xs text-zinc-400 hover:text-zinc-200"
            >
              Manage invites →
            </button>
          )}
        </header>
        {showInvites && slug && (
          <InvitesModal
            workspaceSlug={slug}
            onClose={() => setShowInvites(false)}
          />
        )}

        <nav className="flex-1 overflow-y-auto py-2 min-h-0">
          <ChannelList
            channels={channels}
            activeId={channelId}
            onSelect={handleSelectChannel}
            workspaceSlug={slug}
          />
          <DirectList
            workspaceSlug={slug}
            members={members}
            currentUserID={user.id}
            activeId={channelId}
            onSelect={handleSelectChannel}
            pendingDMs={pendingDMs}
            onAddPendingDM={(d) => setPendingDMs((cur) => [d, ...cur])}
            onRemovePendingDM={(id) =>
              setPendingDMs((cur) => cur.filter((d) => d.id !== id))
            }
          />
        </nav>

        <MemberList members={members} />

        <footer className="border-t border-zinc-800 px-4 py-3 text-sm">
          {onOpenDashboard && (
            <button
              onClick={onOpenDashboard}
              className="block w-full text-left text-xs text-zinc-300 hover:text-zinc-100 mb-2"
            >
              Operator dashboard →
            </button>
          )}
          <div className="text-zinc-300">{user.display_name}</div>
          <div className="text-xs text-zinc-500 truncate">{user.email}</div>
          <button
            onClick={() => logout.mutate()}
            className="mt-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Sign out
          </button>
        </footer>
      </aside>

      <section className="flex flex-col min-w-0 min-h-0 overflow-hidden">
        {activeChannel ? (
          <ChannelView
            channel={activeChannel}
            workspaceSlug={slug ?? ''}
            members={members}
            currentUserID={user.id}
            realtimeOpen={rtState === 'open'}
          />
        ) : (
          <FullPageMessage>Select a channel to start chatting.</FullPageMessage>
        )}
      </section>
      {rtState !== 'open' && (
        <div className="absolute top-2 right-2 rounded bg-zinc-900/80 border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
          {rtState === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </div>
      )}
    </div>
  )
}

function ChannelList({
  channels,
  activeId,
  onSelect,
  workspaceSlug,
}: {
  channels?: Channel[]
  activeId: string | null
  onSelect: (id: string) => void
  workspaceSlug: string | null
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [showBrowse, setShowBrowse] = useState(false)

  return (
    <section>
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500">Channels</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setShowBrowse(true)}
            disabled={!workspaceSlug}
            className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
            title="Browse public channels"
          >
            Browse
          </button>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!workspaceSlug}
            className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
            title="Create channel"
          >
            +
          </button>
        </div>
      </div>

      {!channels ? (
        <div className="px-4 py-2 text-sm text-zinc-500">Loading…</div>
      ) : channels.length === 0 ? (
        <div className="px-4 py-2 text-sm text-zinc-500">No channels yet.</div>
      ) : (
        <ul>
          {channels.map((c) => {
            const active = c.id === activeId
            return (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(c.id)}
                  className={
                    'w-full text-left px-4 py-1.5 text-sm transition-colors ' +
                    (active
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200')
                  }
                >
                  <span className="text-zinc-500 mr-1">#</span>
                  {c.slug ?? '(dm)'}
                  {c.archived && (
                    <span className="ml-2 text-xs text-zinc-600">archived</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {showCreate && workspaceSlug && (
        <CreateChannelModal
          workspaceSlug={workspaceSlug}
          onClose={() => setShowCreate(false)}
          onCreated={(c) => {
            setShowCreate(false)
            onSelect(c.id)
          }}
        />
      )}
      {showBrowse && workspaceSlug && (
        <BrowseChannelsModal
          workspaceSlug={workspaceSlug}
          alreadyJoined={new Set((channels ?? []).map((c) => c.id))}
          onClose={() => setShowBrowse(false)}
          onJoined={(c) => onSelect(c.id)}
        />
      )}
    </section>
  )
}

function CreateChannelModal({
  workspaceSlug,
  onClose,
  onCreated,
}: {
  workspaceSlug: string
  onClose: () => void
  onCreated: (c: Channel) => void
}) {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'public' | 'private'>('public')
  const create = useCreateChannel(workspaceSlug)

  return (
    <ModalShell title="Create channel" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { slug, name: name || undefined, kind },
            {
              onSuccess: (channel) => onCreated(channel),
            },
          )
        }}
        className="space-y-3"
      >
        <ModalField label="Slug" hint="lowercase letters/digits/hyphens, e.g. random">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            required
            className={modalInputClass}
          />
        </ModalField>
        <ModalField label="Name (optional)" hint="defaults to slug">
          <input value={name} onChange={(e) => setName(e.target.value)} className={modalInputClass} />
        </ModalField>
        <ModalField label="Kind">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'public' | 'private')}
            className={modalInputClass}
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </ModalField>
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
    </ModalShell>
  )
}

function BrowseChannelsModal({
  workspaceSlug,
  alreadyJoined,
  onClose,
  onJoined,
}: {
  workspaceSlug: string
  alreadyJoined: Set<string>
  onClose: () => void
  onJoined: (c: Channel) => void
}) {
  const { data: channels, isLoading, error } = usePublicChannels(workspaceSlug)
  const join = useJoinChannel(workspaceSlug)

  return (
    <ModalShell title="Browse public channels" onClose={onClose}>
      {isLoading ? (
        <div className="text-sm text-zinc-500">Loading…</div>
      ) : error ? (
        <div className="text-sm text-rose-400">Error: {String(error)}</div>
      ) : !channels || channels.length === 0 ? (
        <div className="text-sm text-zinc-500">No public channels in this workspace.</div>
      ) : (
        <ul className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
          {channels.map((c) => {
            const joined = alreadyJoined.has(c.id)
            return (
              <li key={c.id} className="py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-zinc-200 truncate">
                    <span className="text-zinc-500">#</span>
                    {c.slug ?? c.name}
                  </div>
                  {c.topic && <div className="text-xs text-zinc-500 truncate">{c.topic}</div>}
                </div>
                {joined ? (
                  <span className="text-xs text-zinc-500 ml-3">Joined</span>
                ) : (
                  <button
                    onClick={() =>
                      join.mutate(c.id, {
                        onSuccess: () => {
                          onJoined(c)
                          onClose()
                        },
                      })
                    }
                    disabled={join.isPending}
                    className="ml-3 rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Join
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {join.error && <p className="mt-3 text-sm text-rose-400">{String(join.error)}</p>}
      <div className="flex justify-end pt-3">
        <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
          Close
        </button>
      </div>
    </ModalShell>
  )
}

function DirectList({
  workspaceSlug,
  members,
  currentUserID,
  activeId,
  onSelect,
  pendingDMs,
  onAddPendingDM,
  onRemovePendingDM,
}: {
  workspaceSlug: string | null
  members: Member[] | undefined
  currentUserID: string
  activeId: string | null
  onSelect: (id: string) => void
  pendingDMs: DMSummary[]
  onAddPendingDM: (d: DMSummary) => void
  onRemovePendingDM: (id: string) => void
}) {
  const { data: dms, isLoading } = useDMs(workspaceSlug)
  const startDM = useStartDM(workspaceSlug)
  const leave = useLeaveChannel(workspaceSlug)
  const [showStart, setShowStart] = useState(false)

  function handleStart(targetMember: Member) {
    startDM.mutate(targetMember.user_id, {
      onSuccess: (channel) => {
        setShowStart(false)
        // Synthesize a sidebar entry so the initiator can see the just-opened
        // DM. Server hides empty DMs from useDMs, so without this it'd render
        // nothing in the sidebar until the first message is posted.
        onAddPendingDM({
          id: channel.id,
          kind: 'dm',
          other_user_ids: [targetMember.user_id],
          other_display_names: [targetMember.display_name],
          other_emails: [targetMember.email],
        })
        onSelect(channel.id)
      },
    })
  }

  function handleClose(d: DMSummary) {
    if (!confirm(`Close conversation with ${dmLabel(d)}? You can re-open it any time.`)) return
    // Pending DMs aren't on the server yet — just drop locally.
    if (pendingDMs.find((p) => p.id === d.id)) {
      onRemovePendingDM(d.id)
      return
    }
    leave.mutate(d.id)
  }

  // Merge real + pending; pending shown first so a brand-new DM lands at top.
  const realIDs = new Set((dms ?? []).map((d) => d.id))
  const visiblePending = pendingDMs.filter((p) => !realIDs.has(p.id))
  const merged: DMSummary[] = [...visiblePending, ...(dms ?? [])]

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500">Direct</h2>
        <button
          onClick={() => setShowStart(true)}
          disabled={!workspaceSlug}
          className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
          title="Start a direct message"
        >
          +
        </button>
      </div>

      {isLoading && merged.length === 0 ? (
        <div className="px-4 py-2 text-sm text-zinc-500">Loading…</div>
      ) : merged.length === 0 ? (
        <div className="px-4 py-2 text-xs text-zinc-500">No DMs yet.</div>
      ) : (
        <ul>
          {merged.map((d) => {
            const active = d.id === activeId
            const label = dmLabel(d)
            return (
              <li key={d.id} className="group relative flex items-center">
                <button
                  onClick={() => onSelect(d.id)}
                  className={
                    'flex-1 text-left px-4 py-1.5 text-sm transition-colors truncate ' +
                    (active
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200')
                  }
                  title={d.other_emails.join(', ')}
                >
                  <span className="text-zinc-500 mr-1">@</span>
                  {label}
                </button>
                <button
                  onClick={() => handleClose(d)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity px-2 text-xs text-zinc-500 hover:text-rose-400"
                  title="Close this conversation"
                  aria-label={`Close conversation with ${label}`}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {showStart && workspaceSlug && (
        <StartDMModal
          members={members ?? []}
          currentUserID={currentUserID}
          onClose={() => setShowStart(false)}
          onStart={handleStart}
          pending={startDM.isPending}
          error={startDM.error ? String(startDM.error) : null}
        />
      )}
    </section>
  )
}

function dmLabel(d: DMSummary): string {
  if (d.other_display_names.length === 0) return '(empty)'
  if (d.other_display_names.length === 1) return d.other_display_names[0]!
  if (d.other_display_names.length <= 3) return d.other_display_names.join(', ')
  return `${d.other_display_names.slice(0, 2).join(', ')} +${d.other_display_names.length - 2}`
}

function StartDMModal({
  members,
  currentUserID,
  onClose,
  onStart,
  pending,
  error,
}: {
  members: Member[]
  currentUserID: string
  onClose: () => void
  onStart: (member: Member) => void
  pending: boolean
  error: string | null
}) {
  const [filter, setFilter] = useState('')
  const others = members.filter((m) => m.user_id !== currentUserID)
  const q = filter.trim().toLowerCase()
  const matched = q
    ? others.filter(
        (m) =>
          m.display_name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q),
      )
    : others

  return (
    <ModalShell title="Start a direct message" onClose={onClose}>
      <input
        autoFocus
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by name or email…"
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
      />
      <ul className="mt-3 max-h-80 overflow-y-auto divide-y divide-zinc-800">
        {matched.length === 0 ? (
          <li className="py-3 text-sm text-zinc-500">
            {q ? 'No members match.' : 'No other members in this workspace.'}
          </li>
        ) : (
          matched.map((m) => (
            <li
              key={m.user_id}
              className="py-2 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm text-zinc-200 truncate">{m.display_name}</div>
                <div className="text-xs text-zinc-500 truncate">{m.email}</div>
              </div>
              <button
                onClick={() => onStart(m)}
                disabled={pending}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Start
              </button>
            </li>
          ))
        )}
      </ul>
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      <div className="flex justify-end pt-3">
        <button
          onClick={onClose}
          className="rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Close
        </button>
      </div>
    </ModalShell>
  )
}

function InvitesModal({
  workspaceSlug,
  onClose,
}: {
  workspaceSlug: string
  onClose: () => void
}) {
  const { data: invites, isLoading, error } = useWorkspaceInvites(workspaceSlug)
  const create = useCreateWorkspaceInvite(workspaceSlug)
  const revoke = useRevokeWorkspaceInvite(workspaceSlug)

  const [role, setRole] = useState<'admin' | 'member' | 'guest'>('member')
  const [email, setEmail] = useState('')
  const [maxUses, setMaxUses] = useState<number>(1)
  const [expiresIn, setExpiresIn] = useState('168h') // 7 days
  const [justMinted, setJustMinted] = useState<InviteWithToken | null>(null)
  const [copied, setCopied] = useState(false)

  function handleMint(e: React.FormEvent) {
    e.preventDefault()
    create.mutate(
      {
        role,
        email: email.trim() || undefined,
        max_uses: maxUses,
        expires_in: expiresIn || undefined,
      },
      {
        onSuccess: (inv) => {
          setJustMinted(inv)
          setCopied(false)
          setEmail('')
        },
      },
    )
  }

  const inviteURL = (token: string) => `${window.location.origin}/invite/${token}`

  return (
    <ModalShell title="Workspace invites" onClose={onClose}>
      <div className="space-y-5">
        <form onSubmit={handleMint} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'member' | 'guest')}
                className={modalInputClass}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="guest">Guest</option>
              </select>
            </ModalField>
            <ModalField label="Max uses">
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className={modalInputClass}
              />
            </ModalField>
          </div>
          <ModalField label="Bound email (optional)" hint="If set, only this address can redeem">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="bob@example.com"
              className={modalInputClass}
            />
          </ModalField>
          <ModalField label="Expires in" hint="Go duration (e.g. 168h, 30m). Leave blank for never.">
            <input
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              placeholder="168h"
              className={modalInputClass}
            />
          </ModalField>
          {create.error && <p className="text-sm text-rose-400">{String(create.error)}</p>}
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-zinc-100 text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-white disabled:opacity-50"
          >
            {create.isPending ? 'Minting…' : 'Mint invite'}
          </button>
        </form>

        {justMinted && (
          <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3 space-y-2">
            <div className="text-xs uppercase tracking-wider text-emerald-400">
              Invite link — copy now, you won't see it again
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteURL(justMinted.token)}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-mono text-zinc-200"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteURL(justMinted.token))
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => setJustMinted(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Dismiss
            </button>
          </div>
        )}

        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Active invites</div>
          {isLoading ? (
            <div className="text-sm text-zinc-500">Loading…</div>
          ) : error ? (
            <div className="text-sm text-rose-400">Error: {String(error)}</div>
          ) : !invites || invites.length === 0 ? (
            <div className="text-sm text-zinc-500">No active invites.</div>
          ) : (
            <ul className="divide-y divide-zinc-800 max-h-64 overflow-y-auto">
              {invites.map((inv) => (
                <InviteRow
                  key={inv.id}
                  inv={inv}
                  onRevoke={() => {
                    if (confirm('Revoke this invite? Anyone with the link will lose access.')) {
                      revoke.mutate(inv.id)
                    }
                  }}
                  pending={revoke.isPending}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

function InviteRow({
  inv,
  onRevoke,
  pending,
}: {
  inv: Invite
  onRevoke: () => void
  pending: boolean
}) {
  const isExhausted = inv.used_count >= inv.max_uses
  const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date()
  const isRevoked = !!inv.revoked_at
  const dead = isRevoked || isExhausted || isExpired
  return (
    <li className="py-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm text-zinc-200 truncate">
          {inv.email ? inv.email : <span className="text-zinc-500">(any email)</span>}
          <span className="ml-2 text-xs text-zinc-500">{inv.role}</span>
        </div>
        <div className="text-xs text-zinc-500">
          {inv.used_count}/{inv.max_uses} used
          {inv.expires_at && (
            <> · expires {new Date(inv.expires_at).toLocaleString()}</>
          )}
          {isRevoked && <span className="ml-2 text-rose-400">revoked</span>}
          {!isRevoked && isExpired && <span className="ml-2 text-amber-400">expired</span>}
          {!isRevoked && !isExpired && isExhausted && <span className="ml-2 text-zinc-500">used up</span>}
        </div>
      </div>
      {!dead && (
        <button
          onClick={onRevoke}
          disabled={pending}
          className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50"
        >
          Revoke
        </button>
      )}
    </li>
  )
}

function MemberList({ members }: { members?: Member[] }) {
  if (!members || members.length === 0) return null
  return (
    <div className="border-t border-zinc-800 max-h-48 overflow-y-auto py-2">
      <h2 className="px-4 pt-2 pb-1 text-xs uppercase tracking-wider text-zinc-500">
        Workspace members
      </h2>
      <ul>
        {members.map((m) => (
          <li key={m.user_id} className="px-4 py-1 text-sm text-zinc-400">
            <span className="text-zinc-500 mr-1">·</span>
            {m.display_name}
            <span className="ml-2 text-xs text-zinc-600">{m.role}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChannelView({
  channel,
  workspaceSlug,
  members,
  currentUserID,
  realtimeOpen,
}: {
  channel: Channel
  workspaceSlug: string
  members?: Member[]
  currentUserID: string
  realtimeOpen: boolean
}) {
  const memberMap = new Map((members ?? []).map((m) => [m.user_id, m]))
  const isDM = channel.kind === 'dm' || channel.kind === 'group_dm'
  const typingUserIDs = useTypingState(channel.id, currentUserID)
  return (
    <>
      <header className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-lg font-semibold">
          <span className="text-zinc-500">{isDM ? '@ ' : '# '}</span>
          {channel.slug ?? channel.name ?? '(dm)'}
        </h1>
        {channel.topic && <p className="text-xs text-zinc-400">{channel.topic}</p>}
      </header>

      <MessageList channelId={channel.id} memberMap={memberMap} realtimeOpen={realtimeOpen} />
      <TypingIndicator userIDs={typingUserIDs} memberMap={memberMap} />
      <Composer
        channelId={channel.id}
        workspaceSlug={workspaceSlug}
        archived={channel.archived}
      />
    </>
  )
}

function TypingIndicator({
  userIDs,
  memberMap,
}: {
  userIDs: string[]
  memberMap: Map<string, Member>
}) {
  // Reserve the row even when empty so the composer doesn't jump.
  const names = userIDs
    .map((id) => memberMap.get(id)?.display_name ?? '…')
    .filter(Boolean)
  let text = ''
  if (names.length === 1) text = `${names[0]} is typing…`
  else if (names.length === 2) text = `${names[0]} and ${names[1]} are typing…`
  else if (names.length === 3) text = `${names[0]}, ${names[1]}, and ${names[2]} are typing…`
  else if (names.length > 3) text = `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing…`
  return (
    <div className="px-4 h-5 text-xs text-zinc-500 italic" aria-live="polite">
      {text}
    </div>
  )
}

function MessageList({
  channelId,
  memberMap,
  realtimeOpen,
}: {
  channelId: string
  memberMap: Map<string, Member>
  realtimeOpen: boolean
}) {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(channelId, realtimeOpen)

  // Flatten newest-first pages, then reverse for natural top-to-bottom rendering.
  const ordered = useMemo(() => {
    if (!data) return []
    const flat = data.pages.flatMap((p) => p.messages)
    return flat.slice().reverse()
  }, [data])

  // ── scroll anchoring ─────────────────────────────────────────────────────
  const scrollerRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  // Track whether the user was pinned at the bottom *before* the latest update.
  // We only auto-scroll on new messages when this is true.
  const stickToBottomRef = useRef(true)
  // When loading older pages, the new content is prepended; preserve the
  // visual position by snapshotting scrollHeight - scrollTop, then restoring.
  const prependAnchorRef = useRef<number | null>(null)
  const lastTopMessageIdRef = useRef<string | null>(null)

  // Decide stickiness on each scroll event.
  function onScroll() {
    const el = scrollerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distanceFromBottom < 80
  }

  // After every render: if we just prepended older messages, restore position;
  // else if user is sticky-at-bottom, scroll to bottom.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el || ordered.length === 0) return
    if (prependAnchorRef.current !== null) {
      // Restore scroll so the visual top stays anchored on the same message.
      el.scrollTop = el.scrollHeight - prependAnchorRef.current
      prependAnchorRef.current = null
      return
    }
    const topMessageId = ordered[0]?.id ?? null
    const isFirstRender = lastTopMessageIdRef.current === null
    lastTopMessageIdRef.current = topMessageId
    if (isFirstRender || stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [ordered])

  // Reset stickiness + anchor when the active channel changes — otherwise the
  // previous channel's "near bottom" state bleeds into the new one.
  useEffect(() => {
    stickToBottomRef.current = true
    lastTopMessageIdRef.current = null
    prependAnchorRef.current = null
  }, [channelId])

  // IntersectionObserver on a sentinel at the top kicks in fetchNextPage.
  useEffect(() => {
    const sentinel = topSentinelRef.current
    const scroller = scrollerRef.current
    if (!sentinel || !scroller || !hasNextPage) return
    const obs = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          // Snapshot the offset from the bottom so useLayoutEffect can restore.
          prependAnchorRef.current = scroller.scrollHeight - scroller.scrollTop
          fetchNextPage()
        }
      },
      { root: scroller, rootMargin: '200px 0px 0px 0px' },
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) {
    return <div className="flex-1 px-4 py-3 text-sm text-zinc-500">Loading…</div>
  }
  if (error) {
    return (
      <div className="flex-1 px-4 py-3 text-sm text-rose-400">
        Error loading messages: {String(error)}
      </div>
    )
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto px-4 py-3"
    >
      <div ref={topSentinelRef} />
      {hasNextPage && (
        <div className="text-center py-2 text-xs text-zinc-500">
          {isFetchingNextPage ? 'Loading older messages…' : 'Scroll up for more'}
        </div>
      )}
      {!hasNextPage && ordered.length > 0 && (
        <div className="text-center py-2 text-xs text-zinc-600">
          — beginning of channel —
        </div>
      )}
      {ordered.length === 0 && (
        <div className="text-sm text-zinc-500">No messages yet. Start the conversation.</div>
      )}
      <ul className="space-y-3">
        {ordered.map((m) => (
          <MessageItem key={m.id} m={m} member={m.user_id ? memberMap.get(m.user_id) : undefined} />
        ))}
      </ul>
    </div>
  )
}

function MessageItem({ m, member }: { m: Message; member?: Member }) {
  const author = member?.display_name ?? '(unknown user)'
  const ts = new Date(m.created_at).toLocaleTimeString()
  return (
    <li>
      <div className="flex items-baseline gap-2">
        <span className="font-medium text-zinc-100">{author}</span>
        <span className="text-xs text-zinc-500">{ts}</span>
        {m.edited_at && <span className="text-xs text-zinc-600">(edited)</span>}
      </div>
      {m.text && (
        <p className="text-zinc-300 whitespace-pre-wrap break-words">{m.text}</p>
      )}
      {m.attachments && m.attachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {m.attachments.map((a) => (
            <AttachmentView key={a.id} a={a} />
          ))}
        </ul>
      )}
    </li>
  )
}

function AttachmentView({ a }: { a: AttachmentFile }) {
  const isImage = a.mime_type.startsWith('image/') && a.url
  if (isImage) {
    // Cap visible size while preserving aspect ratio. Click opens full-size in a new tab.
    return (
      <li>
        <a href={a.url} target="_blank" rel="noopener noreferrer">
          <img
            src={a.url}
            alt={a.filename}
            width={a.image_width}
            height={a.image_height}
            className="max-h-80 max-w-md rounded border border-zinc-800 object-contain bg-zinc-950"
            loading="lazy"
          />
        </a>
      </li>
    )
  }
  return (
    <li>
      <a
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        <span className="text-xl">📄</span>
        <span className="flex flex-col min-w-0">
          <span className="truncate font-medium">{a.filename}</span>
          <span className="text-xs text-zinc-500">{human(a.bytes)} · {a.mime_type}</span>
        </span>
      </a>
    </li>
  )
}

// Local-only attachment slot before the file is finalized server-side.
type PendingAttachment = {
  localId: string
  file: File
  previewURL?: string
  status: 'queued' | 'uploading' | 'ready' | 'error'
  progress: number // 0..1
  finalized?: AttachmentFile
  error?: string
}

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_PER_MESSAGE = 10

function Composer({
  channelId,
  workspaceSlug,
  archived,
}: {
  channelId: string
  workspaceSlug: string
  archived: boolean
}) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const post = usePostMessage(channelId)
  const typing = useTypingNotifier(channelId)

  // Whatever's mounted gets its preview URLs revoked on unmount.
  useEffect(
    () => () => {
      pending.forEach((p) => {
        if (p.previewURL) URL.revokeObjectURL(p.previewURL)
      })
    },
    // intentionally only on unmount; do not retrigger when pending changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  function addFiles(files: File[]) {
    if (archived) return
    if (files.length === 0) return
    const room = MAX_PER_MESSAGE - pending.length
    const accepted = files.slice(0, room)
    const next: PendingAttachment[] = accepted.map((f, i) => {
      const localId = `${Date.now()}-${i}-${f.name}`
      const isImg = f.type.startsWith('image/')
      const oversized = f.size > MAX_FILE_BYTES
      return {
        localId,
        file: f,
        previewURL: isImg ? URL.createObjectURL(f) : undefined,
        status: oversized ? 'error' : 'queued',
        progress: 0,
        error: oversized ? `Too large (${human(f.size)})` : undefined,
      }
    })
    setPending((cur) => [...cur, ...next])
    // Kick uploads for the queued ones.
    next.forEach((slot) => {
      if (slot.status === 'queued') {
        void runUpload(slot.localId, slot.file)
      }
    })
  }

  async function runUpload(localId: string, file: File) {
    setPending((cur) =>
      cur.map((p) => (p.localId === localId ? { ...p, status: 'uploading' } : p)),
    )
    try {
      const finalized = await uploadAttachment(workspaceSlug, file, (frac) => {
        setPending((cur) =>
          cur.map((p) => (p.localId === localId ? { ...p, progress: frac } : p)),
        )
      })
      setPending((cur) =>
        cur.map((p) =>
          p.localId === localId ? { ...p, status: 'ready', finalized, progress: 1 } : p,
        ),
      )
    } catch (err) {
      setPending((cur) =>
        cur.map((p) =>
          p.localId === localId ? { ...p, status: 'error', error: String(err) } : p,
        ),
      )
    }
  }

  function removeAttachment(localId: string) {
    setPending((cur) => {
      const target = cur.find((p) => p.localId === localId)
      if (target?.previewURL) URL.revokeObjectURL(target.previewURL)
      return cur.filter((p) => p.localId !== localId)
    })
  }

  function send() {
    const trimmed = text.trim()
    const ready = pending.filter((p) => p.status === 'ready' && p.finalized)
    const stillUploading = pending.some((p) => p.status === 'uploading' || p.status === 'queued')
    if (stillUploading) return
    if (!trimmed && ready.length === 0) return
    const fileIDs = ready.map((p) => p.finalized!.id)
    typing.stop()
    post.mutate(
      { text: trimmed || '', file_ids: fileIDs.length > 0 ? fileIDs : undefined },
      {
        onSuccess: () => {
          setText('')
          // Clean up previews.
          pending.forEach((p) => {
            if (p.previewURL) URL.revokeObjectURL(p.previewURL)
          })
          setPending([])
        },
      },
    )
  }

  // Drag-drop on the composer card.
  function onDragOver(e: React.DragEvent) {
    if (archived) return
    e.preventDefault()
    setDragActive(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
  }
  function onDrop(e: React.DragEvent) {
    if (archived) return
    e.preventDefault()
    setDragActive(false)
    const dropped = Array.from(e.dataTransfer.files)
    addFiles(dropped)
  }

  // Paste images / files from clipboard.
  function onPaste(e: React.ClipboardEvent) {
    if (archived) return
    const items = Array.from(e.clipboardData.items)
    const files = items
      .filter((it) => it.kind === 'file')
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null)
    if (files.length > 0) {
      e.preventDefault()
      addFiles(files)
    }
  }

  const stillUploading = pending.some((p) => p.status === 'uploading' || p.status === 'queued')
  const canSend = !post.isPending && !stillUploading && (
    text.trim().length > 0 || pending.some((p) => p.status === 'ready')
  )

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={
        'border-t border-zinc-800 p-3 ' +
        (dragActive ? 'bg-zinc-900/60 ring-2 ring-inset ring-zinc-500' : '')
      }
    >
      {pending.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {pending.map((p) => (
            <PendingAttachmentChip
              key={p.localId}
              p={p}
              onRemove={() => removeAttachment(p.localId)}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="flex items-end gap-2"
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={archived || pending.length >= MAX_PER_MESSAGE}
          title={archived ? 'Channel is archived' : 'Attach a file'}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            addFiles(files)
            if (e.target) e.target.value = '' // allow re-selecting same file
          }}
        />
        <textarea
          value={text}
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            if (next.trim().length > 0) typing.notify()
            else typing.stop()
          }}
          onBlur={() => typing.stop()}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={archived ? 'Channel is archived' : 'Message… (drop files or paste images)'}
          disabled={archived}
          rows={2}
          className="flex-1 resize-none rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded bg-zinc-100 text-zinc-900 px-4 py-2 font-medium hover:bg-white disabled:opacity-50"
        >
          {stillUploading ? 'Uploading…' : 'Send'}
        </button>
      </form>
      {post.error && (
        <p className="mt-1 text-xs text-rose-400">{String(post.error)}</p>
      )}
    </div>
  )
}

function PendingAttachmentChip({
  p,
  onRemove,
}: {
  p: PendingAttachment
  onRemove: () => void
}) {
  const isImg = p.file.type.startsWith('image/')
  return (
    <li className="relative flex items-center gap-2 rounded border border-zinc-700 bg-zinc-950 p-1 pr-2 max-w-xs">
      {isImg && p.previewURL ? (
        <img src={p.previewURL} alt="" className="h-12 w-12 object-cover rounded" />
      ) : (
        <div className="h-12 w-12 flex items-center justify-center rounded bg-zinc-900 text-2xl">
          📄
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs text-zinc-300 truncate" title={p.file.name}>
          {p.file.name}
        </div>
        <div className="text-[10px] text-zinc-500">{human(p.file.size)}</div>
        {p.status === 'uploading' && (
          <div className="mt-1 h-0.5 w-full rounded bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round(p.progress * 100)}%` }}
            />
          </div>
        )}
        {p.status === 'error' && (
          <div className="text-[10px] text-rose-400 truncate" title={p.error}>
            {p.error}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-xs text-zinc-500 hover:text-zinc-200 px-1"
        aria-label="Remove attachment"
      >
        ×
      </button>
    </li>
  )
}

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 p-6 text-center">
      {children}
    </div>
  )
}

function FullPageError({ message }: { message: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-zinc-950 text-rose-400 p-6 text-center">
      {message}
    </div>
  )
}

// ---- modal atoms (local — Dashboard has its own copy; refactor later) ------

const modalInputClass =
  'mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none'

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
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

function ModalField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}
