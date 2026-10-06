import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

type ToastData = NonNullable<ReturnType<typeof useStore.getState>['toast']>

const EXIT_MS = 180

/** Brief status message; destructive actions offer an undo right here instead of asking first. */
export function Toast(): React.JSX.Element | null {
  const toast = useStore((s) => s.toast)
  // The last toast stays mounted while it leaves, the way it came in
  const [shown, setShown] = useState<ToastData | null>(toast)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (toast) {
      setShown(toast)
      setClosing(false)
      return
    }
    setClosing(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = setTimeout(() => setShown(null), reduce ? 160 : EXIT_MS)
    return () => clearTimeout(id)
  }, [toast])

  if (!shown) return null
  return <ToastBody key={shown.id} toast={shown} closing={closing} />
}

function ToastBody({ toast, closing }: { toast: ToastData; closing: boolean }): React.JSX.Element {
  // Undo offers stay a little longer so there is time to react; the clock pauses while the
  // pointer or keyboard focus is on the toast
  const remaining = useRef(toast.action ? 6000 : 3200)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (held || closing) return
    const started = performance.now()
    const id = setTimeout(() => {
      if (useStore.getState().toast?.id === toast.id) useStore.setState({ toast: null })
    }, remaining.current)
    return () => {
      clearTimeout(id)
      remaining.current = Math.max(1200, remaining.current - (performance.now() - started))
    }
  }, [held, closing, toast.id])

  return (
    <div
      className={`toast glass ${closing ? 'closing' : ''}`}
      role="status"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span>{toast.text}</span>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            useStore.setState({ toast: null })
            toast.action!.run()
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
