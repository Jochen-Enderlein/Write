import type { UpdateStatus } from '@shared/types'
import { invoke } from '../api'
import { t } from '../i18n'
import { useStore } from '../store'

/** Restarts into the downloaded version; main saves every open page first. */
export function installUpdate(): void {
  void invoke('update:install').catch(useStore.getState().fail)
}

/** The toast offering the restart, shown once when an update has finished downloading. */
export function announceReady(version: string): void {
  useStore.getState().notify(t('update.ready', { version }), {
    label: t('update.restart'),
    run: installUpdate
  })
}

/**
 * "Nach Updates suchen …": unlike the quiet background checks, this always answers – also
 * when everything is up to date, so the click never goes unanswered.
 */
export async function checkForUpdates(): Promise<void> {
  const s = useStore.getState()
  s.notify(t('update.checking'))
  let res: UpdateStatus
  try {
    res = await invoke('update:check')
  } catch (err) {
    return s.fail(err)
  }
  switch (res.state) {
    case 'ready':
      return announceReady(res.version)
    case 'downloading':
      return s.notify(t('update.downloading', { version: res.version }))
    case 'current':
      return s.notify(t('update.current', { version: res.version }))
    case 'disabled':
      return s.notify(t('update.disabled'))
    case 'error':
      return s.notify(t('update.error'))
    default:
      return s.notify(t('update.current', { version: '' }))
  }
}

/** After an update: show what changed since the version used last time (once). */
export async function showWhatsNewIfUpdated(): Promise<void> {
  try {
    const { since } = await invoke('app:whatsNew')
    if (since) useStore.getState().setSheet({ kind: 'whatsNew', since })
  } catch {
    // not worth an error message
  }
}
