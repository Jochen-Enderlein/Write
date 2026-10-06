import { app } from 'electron'
import type { UpdateStatus } from '@shared/types'

export interface Updater {
  status(): UpdateStatus
  /** Looks for an update now; resolves with the state the check ended in. */
  check(): Promise<UpdateStatus>
  /** Saves everything, then restarts into the downloaded version. */
  install(): Promise<void>
}

/**
 * Updates from GitHub Releases (electron-updater). Downloads happen quietly in the background;
 * the app is told about every step and shows a notice once an update is ready, instead of a
 * system notification that is easy to miss. Installs on restart or, at the latest, on quit.
 */
export async function createUpdater(opts: {
  enabled: boolean
  emit(status: UpdateStatus): void
  /** Flushes edits, closes the vault and the index before the app quits for the update. */
  beforeInstall(): Promise<void>
}): Promise<Updater> {
  let status: UpdateStatus = opts.enabled ? { state: 'idle' } : { state: 'disabled' }
  const set = (s: UpdateStatus): void => {
    status = s
    opts.emit(s)
  }
  if (!opts.enabled) {
    return {
      status: () => status,
      check: async () => status,
      install: async () => undefined
    }
  }

  const { default: updater } = await import('electron-updater')
  const au = updater.autoUpdater
  au.autoDownload = true
  au.autoInstallOnAppQuit = true
  au.on('checking-for-update', () => {
    if (status.state !== 'ready' && status.state !== 'downloading') set({ state: 'checking' })
  })
  au.on('update-available', (info) =>
    set({ state: 'downloading', version: info.version, percent: 0 })
  )
  au.on('download-progress', (p) => {
    if (status.state === 'downloading') set({ ...status, percent: Math.round(p.percent) })
  })
  au.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }))
  au.on('update-not-available', () => set({ state: 'current', version: app.getVersion() }))
  au.on('error', (err) => {
    // A failed background check must not hide an update that is already waiting
    if (status.state !== 'ready') set({ state: 'error', message: err?.message ?? String(err) })
  })

  let running: Promise<UpdateStatus> | null = null
  const check = (): Promise<UpdateStatus> => {
    if (status.state === 'ready' || status.state === 'downloading') return Promise.resolve(status)
    running ??= au
      .checkForUpdates()
      .then(() => status)
      .catch((err: Error) => {
        set({ state: 'error', message: err.message })
        return status
      })
      .finally(() => (running = null))
    return running
  }

  return {
    status: () => status,
    check,
    async install() {
      if (status.state !== 'ready') return
      await opts.beforeInstall()
      au.quitAndInstall(false, true)
    }
  }
}
