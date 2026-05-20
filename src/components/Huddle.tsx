// Huddle — fullscreen overlay that hosts a LiveKit room for a channel.
//
// The Stack server mints a JWT (POST /v1/channels/:id/huddle/join); we hand
// the URL + token to <LiveKitRoom> and lean on @livekit/components-react's
// <VideoConference> for the actual UI (participant tiles, mute/cam/screen
// share controls, leave button). Custom UX lives only at the edges:
//
//   • While we wait for the token mint, render a "joining..." spinner.
//   • If the mint fails (most likely cause: huddles disabled on the
//     server, i.e. LIVEKIT_API_KEY unset → 503), show a readable error
//     instead of a blank room.
//   • On unmount or explicit close, call POST .../huddle/leave so the
//     server marks us out and (if we were the last) ends the huddle.
//
// We deliberately do NOT try to wrap LiveKit's own disconnect lifecycle —
// the component disconnect callback fires when the user clicks the leave
// button inside <VideoConference>, which is what we want.

import { useEffect, useRef } from 'react'
import { LiveKitRoom, VideoConference } from '@livekit/components-react'
import '@livekit/components-styles'
import { useJoinHuddle, useLeaveHuddle, type HuddleJoinResponse } from '@stack/client'
import { X } from 'lucide-react'

type Props = {
  channelId: string
  channelLabel: string // shown in the header — e.g. "# huddle-test"
  onClose: () => void
}

export function Huddle({ channelId, channelLabel, onClose }: Props) {
  const join = useJoinHuddle(channelId)
  const leave = useLeaveHuddle(channelId)
  // Track whether we successfully mounted into LiveKit so the unmount
  // cleanup only fires LEAVE for sessions that actually started. Spares
  // the server a 204 on every render of a 503-erroring overlay.
  const enteredRef = useRef(false)

  // Mint the token exactly once when the overlay opens. Re-triggers are
  // pointless — the server is idempotent, but the LiveKit room is mounted
  // on the first token and a second mint just wastes a round-trip.
  useEffect(() => {
    join.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  // On unmount, tell the server we left. Best-effort: a failure here just
  // leaves a stale participant row that the future webhook/sweep will
  // clean up (see HUDDLE.md). Don't await — the overlay is already gone.
  useEffect(() => {
    return () => {
      if (enteredRef.current) {
        leave.mutate()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <div className="text-sm font-medium text-zinc-200">
          Huddle · <span className="text-zinc-500">{channelLabel}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close (leaves the huddle)"
          className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="relative flex-1 min-h-0">
        {join.isPending && <Centered label="Joining huddle…" />}
        {join.isError && (
          <Centered
            label={errorLabel(join.error)}
            detail="Check that LIVEKIT_API_KEY is set on the server and the api container has been rebuilt."
          />
        )}
        {join.data && (
          <LiveKitJoined
            data={join.data}
            onEntered={() => {
              enteredRef.current = true
            }}
            onDisconnect={onClose}
          />
        )}
      </div>
    </div>
  )
}

// LiveKitJoined isolates the <LiveKitRoom> tree so React doesn't try to
// re-mount it on every parent render. The room's lifecycle (connect →
// publish tracks → disconnect) is expensive; keeping it stable matters.
function LiveKitJoined({
  data,
  onEntered,
  onDisconnect,
}: {
  data: HuddleJoinResponse
  onEntered: () => void
  onDisconnect: () => void
}) {
  return (
    <LiveKitRoom
      serverUrl={data.livekit_url}
      token={data.livekit_token}
      // Connect on mount; LiveKit handles the WS + ICE handshake. Once
      // connected, the camera/mic are NOT auto-published — the user
      // chooses in <VideoConference>'s pre-join screen.
      connect={true}
      // Pre-join screen lets the user pick devices + preview before
      // joining. Set to false if you want to skip straight in (we don't —
      // it's the first chance to deny the cam/mic prompt cleanly).
      onConnected={onEntered}
      onDisconnected={onDisconnect}
      // LiveKit's stylesheet expects 'data-lk-theme="default"' on the
      // host. The components handle the dark theme out of the box.
      data-lk-theme="default"
      className="h-full"
    >
      <VideoConference />
    </LiveKitRoom>
  )
}

function Centered({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-300">
      <div className="text-sm">{label}</div>
      {detail && <div className="max-w-md text-center text-xs text-zinc-500">{detail}</div>}
    </div>
  )
}

// Surface the 503 case readably so we don't just stare at "request failed".
function errorLabel(err: unknown): string {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status?: number }).status
    if (status === 503) return 'Huddles are not configured on this server.'
  }
  return 'Could not join the huddle.'
}
