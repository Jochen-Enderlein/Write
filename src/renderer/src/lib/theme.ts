import type { ThemeSetting } from '@shared/types'
import { useStore } from '../store'

const DARK = '(prefers-color-scheme: dark)'

/** What a setting resolves to right now (`system` asks macOS). */
function resolves(theme: ThemeSetting): boolean {
  return theme === 'system' ? window.matchMedia(DARK).matches : theme === 'dark'
}

/** Resolves once the window's colour scheme has flipped (or after a short safety timeout). */
function schemeChange(): Promise<void> {
  return new Promise((resolve) => {
    const mq = window.matchMedia(DARK)
    const done = (): void => {
      mq.removeEventListener('change', done)
      clearTimeout(timer)
      // Let React re-render what depends on the scheme (e.g. the editor theme) before the snapshot
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }
    const timer = setTimeout(done, 400)
    mq.addEventListener('change', done)
  })
}

/**
 * Switches light/dark. The window cross-fades from the old to the new appearance instead of
 * jumping in brightness; with Reduce Motion it switches directly.
 */
export async function setTheme(theme: ThemeSetting): Promise<void> {
  const s = useStore.getState()
  const flips = resolves(theme) !== window.matchMedia(DARK).matches
  const apply = async (): Promise<void> => {
    const changed = flips ? schemeChange() : Promise.resolve()
    await s.updateSettings({ theme })
    await changed
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!flips || reduce || !document.startViewTransition) return apply()
  await document.startViewTransition(apply).finished.catch(() => undefined)
}

/** The menu/palette toggle: to the opposite of what is showing now. */
export function toggleTheme(): Promise<void> {
  return setTheme(window.matchMedia(DARK).matches ? 'light' : 'dark')
}
