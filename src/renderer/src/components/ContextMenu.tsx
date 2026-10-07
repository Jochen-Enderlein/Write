import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  onSelect(): void
  danger?: boolean
  separatorBefore?: boolean
}

/** A glass context menu that appears from the pointer and stays inside the window. */
export function ContextMenu({
  x,
  y,
  items,
  heading,
  onClose
}: {
  x: number
  y: number
  items: MenuItem[]
  /** Small caption above the items, like a macOS menu section title */
  heading?: string
  onClose(): void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.min(x, window.innerWidth - r.width - 8),
      y: Math.min(y, window.innerHeight - r.height - 8)
    })
    el.querySelector('button')?.focus()
  }, [x, y])

  useEffect(() => {
    const close = (e: Event): void => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      onClose()
    }
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const buttons = [...(ref.current?.querySelectorAll('button') ?? [])]
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next =
          buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]
        next?.focus()
      }
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', key, true)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="context-menu glass"
      style={{ left: pos.x, top: pos.y, transformOrigin: `${x - pos.x}px ${y - pos.y}px` }}
    >
      {heading && <div className="context-menu-heading">{heading}</div>}
      {items.map((it, i) => (
        <div key={i}>
          {it.separatorBefore && <hr />}
          <button
            role="menuitem"
            className={it.danger ? 'danger' : undefined}
            onClick={() => {
              onClose()
              it.onSelect()
            }}
          >
            {it.label}
          </button>
        </div>
      ))}
    </div>
  )
}
