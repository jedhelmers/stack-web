// Transcript card + modal viewer.
//
// The Stack server auto-posts a chat message when a recording's transcript
// is ready. The message text is markdown ("📝 Huddle transcript ready —
// [view](…)") and the message payload carries the recording id:
//
//   { kind: 'huddle_transcript', recording_id: '...', huddle_id: '...' }
//
// Chat.tsx's MessageItem detects that payload and renders <TranscriptCard>
// instead of the default TipTap MessageRender. Clicking the card's "View"
// button opens <TranscriptDialog>, which lazy-loads the segments via
// useRecordingTranscript.

import { useEffect, useState } from 'react'
import {
  useHuddle,
  useRecordingTranscript,
  useChannelRecordings,
  type HuddleTranscriptSegment,
} from '@stack/client'
import type { Member } from '@stack/client'
import { FileText, Headphones, X } from 'lucide-react'

// Custom event the HuddleCard's Join button dispatches. The channel
// shell in Chat.tsx listens for it and flips its local huddleOpen state.
// Custom-event indirection keeps us from threading a "join the huddle"
// callback prop through MessageList → MessageItem just for this one card.
export const OPEN_HUDDLE_EVENT = 'stack:open-huddle'
export type OpenHuddleEventDetail = { channelId: string }

// HuddleTranscriptPayload is the shape the server puts on system messages
// posted after a transcript completes. Matches buildTranscriptMessageText
// in internal/huddles/transcribe.go.
export type HuddleTranscriptPayload = {
  kind: 'huddle_transcript'
  recording_id: string
  huddle_id: string
}

// isTranscriptPayload narrows an arbitrary message payload to the
// transcript shape. Use in MessageItem to decide whether to render the
// TranscriptCard instead of the default TipTap renderer.
export function isTranscriptPayload(
  p: unknown,
): p is HuddleTranscriptPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as { kind?: unknown }).kind === 'huddle_transcript' &&
    typeof (p as { recording_id?: unknown }).recording_id === 'string'
  )
}

export function TranscriptCard({
  payload,
  members,
  currentUserID,
}: {
  payload: HuddleTranscriptPayload
  members?: Map<string, Member>
  // When set, the transcript dialog aligns this user's segments on the
  // right (mirroring the chat layout convention) instead of left.
  currentUserID?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="my-1 flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-zinc-100">
            Huddle transcript
          </div>
          <div className="text-xs text-zinc-400">
            Recording {payload.recording_id.slice(0, 8)} · ready
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white"
        >
          View
        </button>
      </div>
      {open && (
        <TranscriptDialog
          recordingId={payload.recording_id}
          members={members}
          currentUserID={currentUserID}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function TranscriptDialog({
  recordingId,
  members,
  currentUserID,
  onClose,
}: {
  recordingId: string
  members?: Map<string, Member>
  currentUserID?: string
  onClose: () => void
}) {
  const { data, isLoading, isError } = useRecordingTranscript(recordingId)

  // Close on Escape — standard modal nicety.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        // Backdrop click closes; click inside the panel does nothing.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Huddle transcript
            </h2>
            <p className="text-xs text-zinc-500">
              Recording {recordingId.slice(0, 8)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-auto px-4 py-3">
          {isLoading && <p className="text-sm text-zinc-400">Loading transcript…</p>}
          {isError && (
            <p className="text-sm text-rose-400">
              Could not load transcript. It may still be processing.
            </p>
          )}
          {data && data.transcript === null && (
            <p className="text-sm text-zinc-400">
              Transcript is {data.recording.status}. This view will refresh
              automatically when it's ready.
            </p>
          )}
          {data && data.transcript && data.transcript.length === 0 && (
            <p className="text-sm text-zinc-400">No speech detected.</p>
          )}
          {data && data.transcript && data.transcript.length > 0 && (
            <TranscriptSegments
              segments={data.transcript}
              members={members}
              currentUserID={currentUserID}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function TranscriptSegments({
  segments,
  members,
  currentUserID,
}: {
  segments: HuddleTranscriptSegment[]
  members?: Map<string, Member>
  // When provided, segments by this speaker render right-aligned with a
  // distinct bubble color — same convention as the chat message feed.
  currentUserID?: string
}) {
  // Group consecutive segments from the same speaker into a single block —
  // way more readable than a per-segment dump. We re-segment on every
  // speaker change in the chronological-by-offset order the server sends.
  type Block = {
    speakerUserId: string
    startedAt: number
    segments: HuddleTranscriptSegment[]
  }
  const blocks: Block[] = []
  for (const s of segments) {
    const last = blocks[blocks.length - 1]
    if (last && last.speakerUserId === s.speaker_user_id) {
      last.segments.push(s)
    } else {
      blocks.push({
        speakerUserId: s.speaker_user_id,
        startedAt: s.started_offset_ms,
        segments: [s],
      })
    }
  }
  return (
    <ul className="space-y-3">
      {blocks.map((b, i) => {
        const isMe = currentUserID !== undefined && b.speakerUserId === currentUserID
        // Right-aligned for the current user, left-aligned for everyone
        // else. Timestamp swaps sides too so it always trails the bubble
        // (chat convention: timestamp on the "outside" edge).
        return (
          <li
            key={i}
            className={'flex gap-3 ' + (isMe ? 'flex-row-reverse' : '')}
          >
            <div className="w-16 shrink-0 pt-1 text-xs text-zinc-500 tabular-nums text-right">
              {formatOffset(b.startedAt)}
            </div>
            <div
              className={
                'min-w-0 max-w-[80%] ' + (isMe ? 'text-right' : 'text-left')
              }
            >
              <div className="text-xs font-medium text-zinc-300">
                {isMe ? 'You' : labelForSpeaker(b.speakerUserId, members)}
              </div>
              <p
                className={
                  'mt-0.5 inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-sm text-left ' +
                  (isMe
                    ? 'bg-emerald-600/20 text-emerald-50'
                    : 'bg-zinc-800 text-zinc-100')
                }
              >
                {b.segments.map((s) => s.text.trim()).join(' ')}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function formatOffset(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function labelForSpeaker(userId: string, members?: Map<string, Member>): string {
  const m = members?.get(userId)
  if (m?.display_name) return m.display_name
  // No member metadata available (e.g. transcript opened from outside a
  // channel context). Fall back to the UUID prefix — readable enough to
  // distinguish speakers in a tight conversation.
  return userId.slice(0, 8)
}

// ────────────────────────────────────────────────────────────────────
// Huddle-started chat card
//
// The server posts a system-ish message into the channel timeline when
// someone starts a huddle (see postHuddleStartedMessage in
// internal/huddles/handlers.go). The payload's `kind` is "huddle_started"
// and carries the huddle id. Chat.tsx detects it and renders this card
// instead of the default TipTap renderer — same swap pattern as the
// transcript card.
//
// The card shows a Join button if the huddle is still live, else
// "Huddle ended". "Still live" is determined by comparing the payload's
// huddle_id against useChannelHuddle(channelId) — but to keep the surface
// flat we don't import useHuddle here; instead the parent passes a
// `huddleIsLive` boolean (or the parent's onJoin callback decides).

export type HuddleStartedPayload = {
  kind: 'huddle_started'
  huddle_id: string
}

export function isHuddleStartedPayload(p: unknown): p is HuddleStartedPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as { kind?: unknown }).kind === 'huddle_started' &&
    typeof (p as { huddle_id?: unknown }).huddle_id === 'string'
  )
}

export function HuddleCard({
  payload,
  channelId,
  realtimeOpen = false,
}: {
  payload: HuddleStartedPayload
  channelId: string
  realtimeOpen?: boolean
}) {
  // Live state pulled from the server's view of the channel's current
  // huddle. The card is "live" only if the channel's CURRENT active
  // huddle matches the payload's huddle_id — otherwise this card
  // belongs to a previous (now-ended) huddle.
  const { data } = useHuddle(channelId, realtimeOpen)
  const isLive = data?.huddle?.id === payload.huddle_id

  const onJoin = () => {
    // Custom-event indirection — see OPEN_HUDDLE_EVENT at the top of
    // the file for why we don't just call a prop callback.
    window.dispatchEvent(
      new CustomEvent<OpenHuddleEventDetail>(OPEN_HUDDLE_EVENT, {
        detail: { channelId },
      }),
    )
  }

  return (
    <div className="my-1 flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <div
        className={
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md ' +
          (isLive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-400')
        }
      >
        <Headphones className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-zinc-100">
          {isLive ? 'Huddle in progress' : 'Huddle ended'}
        </div>
        <div className="text-xs text-zinc-400">
          {isLive ? 'Jump in to talk' : `Started here · ${payload.huddle_id.slice(0, 8)}`}
        </div>
      </div>
      {isLive && (
        <button
          type="button"
          onClick={onJoin}
          className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-emerald-400"
        >
          Join
        </button>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Recordings sidebar panel
//
// Lists past recordings in the channel, newest first. Click → opens the
// transcript dialog (same one the chat-card "View" button uses). Hosted
// in the existing RightSidebar — Chat.tsx slots it in like Pins.

export function RecordingsPanel({
  channelId,
  members,
  currentUserID,
  realtimeOpen = false,
}: {
  channelId: string
  members?: Map<string, Member>
  // Forwards to the transcript dialog so the current user's segments
  // render right-aligned, matching the chat layout convention.
  currentUserID?: string
  realtimeOpen?: boolean
}) {
  const { data, isLoading, isError } = useChannelRecordings(channelId, realtimeOpen)
  const [openId, setOpenId] = useState<string | null>(null)

  if (isLoading) {
    return <PanelMessage>Loading recordings…</PanelMessage>
  }
  if (isError) {
    return <PanelMessage tone="error">Could not load recordings.</PanelMessage>
  }
  const recs = data?.recordings ?? []
  if (recs.length === 0) {
    return (
      <PanelMessage>
        No recordings in this channel yet. Hit the Record button inside a
        huddle to capture one.
      </PanelMessage>
    )
  }

  return (
    <>
      <ul className="divide-y divide-zinc-800">
        {recs.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => r.status === 'ready' && setOpenId(r.id)}
              disabled={r.status !== 'ready'}
              className={
                'flex w-full items-start gap-3 px-3 py-2 text-left ' +
                (r.status === 'ready'
                  ? 'hover:bg-zinc-800/50'
                  : 'opacity-70 cursor-default')
              }
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-100 truncate">
                  Recording {r.id.slice(0, 8)}
                </div>
                <div className="text-xs text-zinc-500">
                  {formatTimestamp(r.started_at)} · <StatusLabel status={r.status} />
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {openId && (
        <TranscriptDialog
          recordingId={openId}
          members={members}
          currentUserID={currentUserID}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}

function PanelMessage({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: 'error'
}) {
  return (
    <div
      className={
        'px-3 py-4 text-sm ' +
        (tone === 'error' ? 'text-rose-400' : 'text-zinc-400')
      }
    >
      {children}
    </div>
  )
}

function StatusLabel({ status }: { status: string }) {
  // Visual emphasis on the two states folks act on. 'processing' is the
  // most common waiting state — Whisper takes 10-30s for short audio.
  switch (status) {
    case 'ready':
      return <span className="text-emerald-400">ready</span>
    case 'recording':
      return <span className="text-rose-400">recording</span>
    case 'processing':
      return <span className="text-amber-400">transcribing…</span>
    case 'failed':
      return <span className="text-rose-400">failed</span>
    default:
      return <span className="text-zinc-500">{status}</span>
  }
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
