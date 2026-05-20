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
import { useRecordingTranscript, type HuddleTranscriptSegment } from '@stack/client'
import type { Member } from '@stack/client'
import { FileText, X } from 'lucide-react'

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
}: {
  payload: HuddleTranscriptPayload
  members?: Map<string, Member>
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
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function TranscriptDialog({
  recordingId,
  members,
  onClose,
}: {
  recordingId: string
  members?: Map<string, Member>
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
            <TranscriptSegments segments={data.transcript} members={members} />
          )}
        </div>
      </div>
    </div>
  )
}

function TranscriptSegments({
  segments,
  members,
}: {
  segments: HuddleTranscriptSegment[]
  members?: Map<string, Member>
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
      {blocks.map((b, i) => (
        <li key={i} className="flex gap-3">
          <div className="w-16 shrink-0 pt-1 text-xs text-zinc-500 tabular-nums">
            {formatOffset(b.startedAt)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-zinc-300">
              {labelForSpeaker(b.speakerUserId, members)}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-100">
              {b.segments.map((s) => s.text.trim()).join(' ')}
            </p>
          </div>
        </li>
      ))}
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
