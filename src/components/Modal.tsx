import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'

// A single global modal slot. Mirrors RightSidebar — one thing open at a
// time. Stacking modals is a UX trap (where does Escape go?) so we don't.
// Opening a new slot replaces what was there.

export type ModalSlot = {
  // Stable id so consumers can ask "is *my* modal currently open?".
  id: string
  // Title rendered in the modal header; omit to render a chromeless modal
  // (body is responsible for its own close affordance).
  title?: string
  body: ReactNode
  // Width hint. Default 'md' (~28rem). Use 'lg' for tables, 'sm' for confirms.
  size?: 'sm' | 'md' | 'lg'
  // Extra cleanup hook fired after the default close behavior.
  onClose?: () => void
}

type Ctx = {
  slot: ModalSlot | null
  open: (slot: ModalSlot) => void
  close: () => void
  isOpen: (id: string) => boolean
}

const ModalContext = createContext<Ctx | null>(null)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ModalSlot | null>(null)
  const open = useCallback((next: ModalSlot) => setSlot(next), [])
  const close = useCallback(() => {
    setSlot((cur) => {
      cur?.onClose?.()
      return null
    })
  }, [])
  const isOpen = useCallback(
    (id: string) => slot?.id === id,
    [slot?.id],
  )
  const value = useMemo<Ctx>(
    () => ({ slot, open, close, isOpen }),
    [slot, open, close, isOpen],
  )
  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  )
}

export function useModal(): Ctx {
  const ctx = useContext(ModalContext)
  if (!ctx) {
    throw new Error('useModal must be used inside <ModalProvider>')
  }
  return ctx
}

// Modal — the chrome (backdrop, panel, header, close button). Renders nothing
// when no slot is active so it stays out of the DOM. Escape closes; clicking
// the backdrop closes; the inner panel stops propagation so internal clicks
// don't dismiss.
export function Modal() {
  const { slot, close } = useModal()

  useEffect(() => {
    if (!slot) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slot, close])

  if (!slot) return null

  const sizeClass =
    slot.size === 'lg' ? 'max-w-2xl' :
    slot.size === 'sm' ? 'max-w-sm' :
    'max-w-md'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={close}
      role="presentation"
    >
      <div
        className={`flex w-full ${sizeClass} max-h-[80vh] flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={slot.title}
      >
        {slot.title && (
          <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-semibold">{slot.title}</h2>
            <button
              type="button"
              onClick={close}
              title="Close"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">{slot.body}</div>
      </div>
    </div>
  )
}
