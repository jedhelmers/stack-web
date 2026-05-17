// GiphyPicker — pre-send preview for /giphy. Opens above the composer card
// when the user types `/giphy <query>` and hits enter. Renders one gif at a
// time with [Next] to roll another (same query, fresh /random call) and
// [Send] to commit as a normal message. [Cancel] / Escape dismisses.
//
// Lives separately from the giphy slash command plugin because it has to
// reach into the Composer's send pipeline — the slash command API is
// fire-and-forget by design, so picker UX is built directly into the
// Composer rather than as a generic plugin extension.

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, SendHorizontal, X as XIcon } from 'lucide-react'
import { api, APIError } from '@stack/client'

// Server response shape from GET /v1/integrations/giphy/random?q=<query>.
// Mirrors the GiphyPayload defined in plugins/giphy.tsx — kept local so the
// picker has no import cycle with the plugin.
type GiphyRandomResponse = {
  url: string
  width: number
  height: number
  title?: string
  query: string
}

// What gets sent when the user picks [Send]. The composer feeds these
// straight into post.mutate. Shape matches what /giphy used to return.
export type GiphyPickResult = {
  text: string
  payload: {
    type: 'giphy'
    url: string
    width: number
    height: number
    title?: string
    query: string
  }
}

export function GiphyPicker({
  query,
  onSend,
  onCancel,
}: {
  query: string
  onSend: (result: GiphyPickResult) => void
  onCancel: () => void
}) {
  const [gif, setGif] = useState<GiphyRandomResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOne = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<GiphyRandomResponse>(
        `/v1/integrations/giphy/random?q=${encodeURIComponent(query)}`,
      )
      if (!data?.url) {
        setError(`No results for "${query}"`)
        setGif(null)
      } else {
        setGif(data)
      }
    } catch (err) {
      if (err instanceof APIError) {
        if (err.status === 503) {
          setError('Giphy is not configured on this server (set GIPHY_API_KEY).')
        } else if (err.status === 502) {
          setError('Giphy upstream is failing — try again in a moment.')
        } else {
          setError(`Couldn't reach Giphy (${err.status}).`)
        }
      } else {
        setError("Couldn't reach Giphy.")
      }
      setGif(null)
    } finally {
      setLoading(false)
    }
  }, [query])

  // Fetch the first gif on mount + whenever the query changes.
  useEffect(() => {
    void fetchOne()
  }, [fetchOne])

  // Escape closes the picker. Bound on window so it works even when focus
  // sat in the composer editor before the picker opened.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function handleSend() {
    if (!gif) return
    onSend({
      // Plain-text fallback so search / notifications / accessibility have
      // something readable even before the renderer mounts. Matches what
      // the legacy non-picker /giphy flow used to post.
      text: `/giphy ${gif.query}`,
      payload: {
        type: 'giphy',
        url: gif.url,
        width: gif.width || 0,
        height: gif.height || 0,
        title: gif.title,
        query: gif.query,
      },
    })
  }

  return (
    <div className="absolute bottom-full left-3 right-3 mb-2 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-wide text-zinc-500">
          Giphy preview — <span className="text-zinc-300">/giphy {query}</span>
        </span>
        <button
          type="button"
          onClick={onCancel}
          title="Cancel (Esc)"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex min-h-[180px] items-center justify-center p-3">
        {loading && (
          <span className="text-sm text-zinc-500">Fetching a gif…</span>
        )}
        {!loading && error && (
          <span className="text-sm text-rose-400">{error}</span>
        )}
        {!loading && !error && gif && (
          <img
            src={gif.url}
            alt={gif.title ?? gif.query}
            width={gif.width || undefined}
            height={gif.height || undefined}
            className="max-h-64 rounded border border-zinc-800 object-contain"
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-zinc-400 hover:text-zinc-100"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchOne()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !gif}
            className="inline-flex items-center gap-1 rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Send <SendHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
