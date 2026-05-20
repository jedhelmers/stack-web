// Huddle — fullscreen overlay that hosts a LiveKit room for a channel.
//
// The Stack server mints a JWT (POST /v1/channels/:id/huddle/join); we hand
// the URL + token to <LiveKitRoom> and compose our own UI on top of
// @livekit/components-react primitives. We deliberately skip the
// <VideoConference> prefab so the look matches the rest of the app
// instead of LiveKit's stock dark theme.
//
//   • While we wait for the token mint, render a "joining…" spinner.
//   • If the mint fails (most likely cause: huddles disabled on the
//     server, i.e. LIVEKIT_API_KEY unset → 503), show a readable error
//     instead of a blank room.
//   • On unmount or explicit close, call POST .../huddle/leave so the
//     server marks us out and (if we were the last) ends the huddle.

import { useEffect, useRef } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  ParticipantName,
  ParticipantContextIfNeeded,
  useTracks,
  useParticipants,
  useLocalParticipant,
  useIsSpeaking,
  useIsMuted,
  useTrackToggle,
  useDisconnectButton,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'
import { useJoinHuddle, useLeaveHuddle, type HuddleJoinResponse } from '@stack/client'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  PhoneOff,
  X,
  User,
} from 'lucide-react'

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

  useEffect(() => {
    join.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

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
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800/80 px-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="font-medium text-zinc-100">Huddle</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">{channelLabel}</span>
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
      connect={true}
      audio={true}
      video={false}
      onConnected={onEntered}
      onDisconnected={onDisconnect}
      className="flex h-full flex-col"
    >
      <HuddleStage />
      <RoomAudioRenderer />
      <ControlBar onLeave={onDisconnect} />
    </LiveKitRoom>
  )
}

// HuddleStage — responsive grid of participant tiles.
function HuddleStage() {
  // One camera track ref per participant (placeholder if camera off), plus
  // any active screen-shares as extra tiles.
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  const count = tracks.length
  const cols = gridCols(count)

  return (
    <div className="flex-1 min-h-0 overflow-auto px-6 pt-6 pb-32">
      <div
        className="mx-auto grid h-full w-full max-w-6xl gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {tracks.map((trackRef) => (
          <Tile
            key={`${trackRef.participant.identity}:${trackRef.source}:${trackRef.publication?.trackSid ?? 'placeholder'}`}
            trackRef={trackRef}
          />
        ))}
      </div>
    </div>
  )
}

function gridCols(n: number): number {
  if (n <= 1) return 1
  if (n <= 4) return 2
  if (n <= 9) return 3
  return 4
}

// Tile — one participant card. Video if available; otherwise avatar +
// name + mic indicator. Glowing ring while speaking.
function Tile({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  const isScreenShare = trackRef.source === Track.Source.ScreenShare
  const hasVideo = !!trackRef.publication && !trackRef.publication.isMuted
  const isSpeaking = useIsSpeaking(trackRef.participant)
  // Mic-muted indicator — read against the microphone track, not the
  // tile's track (which is the camera for camera tiles).
  const micRef: TrackReferenceOrPlaceholder = {
    participant: trackRef.participant,
    source: Track.Source.Microphone,
    publication: trackRef.participant.getTrackPublication(Track.Source.Microphone),
  }
  const micMuted = useIsMuted(micRef)

  return (
    <ParticipantContextIfNeeded participant={trackRef.participant}>
      <div
        className={[
          'group relative aspect-video overflow-hidden rounded-xl bg-zinc-900',
          'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]',
          'transition-shadow duration-150',
          isSpeaking && !isScreenShare
            ? 'ring-2 ring-emerald-500/80 ring-offset-2 ring-offset-zinc-950'
            : '',
        ].join(' ')}
      >
        {hasVideo ? (
          <VideoTrack
            trackRef={trackRef as never}
            className={
              isScreenShare
                ? 'h-full w-full object-contain'
                : 'h-full w-full object-cover'
            }
          />
        ) : (
          <Placeholder />
        )}

        {isScreenShare && (
          <div className="absolute left-3 top-3 rounded-md bg-zinc-950/70 px-2 py-1 text-[11px] font-medium text-zinc-200 backdrop-blur">
            Screen
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-zinc-950/80 via-zinc-950/40 to-transparent px-3 pb-2 pt-6">
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-100">
            {micMuted ? (
              <MicOff className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            ) : (
              <Mic className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
            )}
            <ParticipantName className="truncate" />
          </div>
        </div>
      </div>
    </ParticipantContextIfNeeded>
  )
}

function Placeholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-700/60 text-zinc-300">
        <User className="h-10 w-10" />
      </div>
    </div>
  )
}

// ControlBar — floating pill at the bottom-center. Mic / camera / screen
// share toggles + leave button. Buttons are circular with a label below
// (Slack/Discord huddle style).
function ControlBar({ onLeave }: { onLeave: () => void }) {
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()

  const mic = useTrackToggle({ source: Track.Source.Microphone })
  const cam = useTrackToggle({ source: Track.Source.Camera })
  const screen = useTrackToggle({ source: Track.Source.ScreenShare })

  const disconnect = useDisconnectButton({})

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur">
        <span className="px-2 text-xs text-zinc-400">
          {participants.length} {participants.length === 1 ? 'person' : 'people'}
        </span>
        <span className="h-6 w-px bg-zinc-800" />

        <CtrlButton
          label={mic.enabled ? 'Mute' : 'Unmute'}
          danger={!mic.enabled}
          pending={mic.pending}
          onClick={() => mic.toggle()}
          title={mic.enabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {mic.enabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </CtrlButton>

        <CtrlButton
          label={cam.enabled ? 'Stop video' : 'Start video'}
          danger={!cam.enabled}
          pending={cam.pending}
          onClick={() => cam.toggle()}
          title={cam.enabled ? 'Turn camera off' : 'Turn camera on'}
        >
          {cam.enabled ? (
            <VideoIcon className="h-4 w-4" />
          ) : (
            <VideoOff className="h-4 w-4" />
          )}
        </CtrlButton>

        <CtrlButton
          label={screen.enabled ? 'Stop share' : 'Share'}
          active={screen.enabled}
          pending={screen.pending}
          onClick={() => screen.toggle()}
          title={screen.enabled ? 'Stop screen share' : 'Share screen'}
          disabled={!localParticipant?.permissions?.canPublish}
        >
          <MonitorUp className="h-4 w-4" />
        </CtrlButton>

        <span className="h-6 w-px bg-zinc-800" />

        <button
          type="button"
          {...disconnect.buttonProps}
          onClick={(e) => {
            disconnect.buttonProps.onClick?.(e)
            // onDisconnected on <LiveKitRoom> will fire onLeave too, but
            // call it eagerly so the overlay closes without a frame of
            // post-disconnect emptiness.
            onLeave()
          }}
          title="Leave huddle"
          className="flex items-center gap-2 rounded-full bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-500 active:bg-rose-700"
        >
          <PhoneOff className="h-4 w-4" />
          <span>Leave</span>
        </button>
      </div>
    </div>
  )
}

function CtrlButton({
  children,
  label,
  onClick,
  title,
  danger,
  active,
  pending,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  title: string
  danger?: boolean
  active?: boolean
  pending?: boolean
  disabled?: boolean
}) {
  const base =
    'flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40'
  const style = danger
    ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
    : active
      ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
      : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        disabled={disabled || pending}
        className={`${base} ${style}`}
      >
        {children}
      </button>
      <span className="text-[10px] leading-none text-zinc-500">{label}</span>
    </div>
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
