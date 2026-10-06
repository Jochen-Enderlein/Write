import type { BrowserWindow } from 'electron'
import { env } from './env'
import { createRequire } from 'node:module'

/**
 * Wraps the Liquid Glass integration so the community package can be swapped out (e.g. once
 * Electron ships glass natively). Falls back to classic vibrancy.
 */
export interface GlassService {
  readonly native: boolean
  apply(win: BrowserWindow, opts?: { cornerRadius?: number }): void
}

interface LiquidGlassModule {
  addView(
    handle: Buffer,
    opts?: { cornerRadius?: number; tintColor?: string; opaque?: boolean }
  ): number
}

function loadLiquidGlass(): LiquidGlassModule | null {
  if (process.platform !== 'darwin' || env('NO_GLASS')) return null
  try {
    const require = createRequire(import.meta.url)
    const mod = require('electron-liquid-glass')
    return (mod.default ?? mod) as LiquidGlassModule
  } catch (err) {
    console.warn('[glass] electron-liquid-glass nicht verfügbar, nutze Vibrancy', err)
    return null
  }
}

export function createGlassService(): GlassService {
  const lg = loadLiquidGlass()
  return {
    native: lg !== null,
    apply(win, opts = {}) {
      if (lg) {
        try {
          lg.addView(win.getNativeWindowHandle(), { cornerRadius: opts.cornerRadius })
          return
        } catch (err) {
          console.warn('[glass] addView fehlgeschlagen, nutze Vibrancy', err)
        }
      }
      if (process.platform === 'darwin') win.setVibrancy('sidebar')
    }
  }
}
