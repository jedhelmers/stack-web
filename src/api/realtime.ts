// Tiny WebSocket client. Auth is via the session cookie (sent automatically by the
// browser on same-origin WS upgrades). Reconnects with capped exponential backoff.

import type { Message } from './client'

export type RealtimeEvent =
  | { type: 'message.created'; workspace_id: string; channel_id: string; message_id: string; payload: Message; emitted_at: string }
  | { type: 'message.updated'; workspace_id: string; channel_id: string; message_id: string; payload: Message; emitted_at: string }
  | { type: 'message.deleted'; workspace_id: string; channel_id: string; message_id: string; payload: Message; emitted_at: string }
  | { type: 'typing.started'; workspace_id: string; channel_id: string; user_id: string; emitted_at: string }
  | { type: 'typing.stopped'; workspace_id: string; channel_id: string; user_id: string; emitted_at: string }

export type Listener = (ev: RealtimeEvent) => void

export type ConnectionState = 'connecting' | 'open' | 'closed'

export class RealtimeClient {
  private ws: WebSocket | null = null
  private listeners = new Set<Listener>()
  private stateListeners = new Set<(s: ConnectionState) => void>()
  private state: ConnectionState = 'closed'
  private retryDelay = 500
  private readonly maxDelay = 30_000
  private stopped = false
  private reconnectTimer: number | null = null

  constructor(private url: string) {}

  start() {
    this.stopped = false
    this.connect()
  }

  stop() {
    this.stopped = true
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.setState('closed')
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onState(listener: (s: ConnectionState) => void): () => void {
    this.stateListeners.add(listener)
    listener(this.state)
    return () => this.stateListeners.delete(listener)
  }

  private setState(s: ConnectionState) {
    if (this.state === s) return
    this.state = s
    this.stateListeners.forEach((l) => l(s))
  }

  private connect() {
    if (this.stopped) return
    this.setState('connecting')

    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.onopen = () => {
      this.retryDelay = 500
      this.setState('open')
    }

    ws.onmessage = (evt) => {
      let parsed: RealtimeEvent
      try {
        parsed = JSON.parse(evt.data)
      } catch {
        return
      }
      this.listeners.forEach((l) => l(parsed))
    }

    ws.onerror = () => {
      // Browser fires error before close; close handler does the actual reconnect.
    }

    ws.onclose = () => {
      this.ws = null
      this.setState('closed')
      if (this.stopped) return
      this.reconnectTimer = window.setTimeout(() => this.connect(), this.retryDelay)
      this.retryDelay = Math.min(this.retryDelay * 2, this.maxDelay)
    }
  }
}

// Builds the WS URL from the current window location, so it works across
// dev (localhost:5173 → ws://localhost:5173/api/v1/realtime) and prod
// (host:8081 → ws://host:8081/api/v1/realtime).
export function realtimeURL(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/api/v1/realtime`
}
