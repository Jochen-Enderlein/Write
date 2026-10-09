import { createContext, useContext, useEffect, useRef } from 'react'
import { useStore, type Pane } from '../store'

/** Which pane a page view, its editor and its title belong to. */
export const PaneContext = createContext<Pane>('main')

export function usePane(): Pane {
  return useContext(PaneContext)
}

/** Whether global commands (rename, icon …) currently reach this pane. */
export function useIsActivePane(): boolean {
  const pane = usePane()
  return useStore((s) => s.activePane === pane)
}

/**
 * The same page can be open in both panes. The vault does not report a window's own writes back
 * to it, so a pane announces its saves here and the other one reloads.
 */
const saves = new EventTarget()

export function announceSaved(path: string, pane: Pane): void {
  saves.dispatchEvent(new CustomEvent('saved', { detail: { path, pane } }))
}

/** Calls `fn` when the other pane saved `path`. */
export function useSavedElsewhere(path: string | null, fn: () => void): void {
  const pane = usePane()
  const cb = useRef(fn)
  cb.current = fn
  useEffect(() => {
    if (!path) return
    const on = (e: Event): void => {
      const d = (e as CustomEvent<{ path: string; pane: Pane }>).detail
      if (d.path === path && d.pane !== pane) cb.current()
    }
    saves.addEventListener('saved', on)
    return () => saves.removeEventListener('saved', on)
  }, [path, pane])
}
