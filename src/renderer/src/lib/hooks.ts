import { useEffect, useRef, useState } from 'react'
import type { IpcEvent, IpcEvents } from '@shared/ipc'
import { on } from '../api'
import { locale } from '../i18n'

export function useColorScheme(): 'light' | 'dark' {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = (): void => setDark(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return dark ? 'dark' : 'light'
}

/** Subscribes to a main-process event; the latest listener is always used. */
export function useIpcEvent<E extends IpcEvent>(
  event: E,
  listener: (...args: IpcEvents[E]) => void
): void {
  const ref = useRef(listener)
  ref.current = listener
  useEffect(() => on(event, (...args) => ref.current(...args)), [event])
}

export function useElementSize<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  { width: number; height: number }
] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

/** Keeps a closing overlay mounted until its exit animation finished. */
export function usePresence(open: boolean, exitMs = 180): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      return
    }
    if (!mounted) return
    setClosing(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = setTimeout(
      () => {
        setMounted(false)
        setClosing(false)
      },
      reduce ? 160 : exitMs
    )
    return () => clearTimeout(id)
  }, [open, mounted, exitMs])
  return { mounted, closing }
}

export function relativeTime(ms: number): string {
  const diff = (ms - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day')
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(ms)
}

export function formatDate(iso: string | number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}
