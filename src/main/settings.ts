import { app } from 'electron'
import path from 'node:path'
import type { AppSettings, VaultInfo } from '@shared/types'
import { DEFAULT_CAPTURE_SHORTCUT } from '@shared/keymap'
import { readJson, writeJson } from './fsutil'

interface SettingsFile {
  vaults: VaultInfo[]
  lastVaultId: string | null
  settings: AppSettings
  windowBounds?: { x: number; y: number; width: number; height: number }
  sidebarWidth?: number
  /** App version at the last start; a higher version now means "show what's new". */
  seenVersion?: string
  /** Number of app starts, so the update question waits until the second one. */
  launches?: number
}

const defaults: SettingsFile = {
  vaults: [],
  lastVaultId: null,
  settings: {
    trashRetentionDays: 30,
    snapshotDelayMs: 4000,
    captureShortcut: DEFAULT_CAPTURE_SHORTCUT,
    historyRetentionDays: 0,
    editorFont: 'sans',
    editorFontSize: 16,
    editorWidth: 'normal',
    smartTypography: true,
    language: 'system',
    theme: 'system',
    autoUpdates: 'ask',
    mcpAccess: 'off'
  }
}

let cache: SettingsFile | null = null

const file = (): string => path.join(app.getPath('userData'), 'settings.json')

export async function loadSettings(): Promise<SettingsFile> {
  if (!cache) {
    const loaded = await readJson<Partial<SettingsFile>>(file(), {})
    cache = { ...defaults, ...loaded, settings: { ...defaults.settings, ...loaded.settings } }
  }
  return cache
}

export async function saveSettings(update: (s: SettingsFile) => void): Promise<SettingsFile> {
  const s = await loadSettings()
  update(s)
  await writeJson(file(), s)
  return s
}

/** Local, non-synced data of one vault: index, snapshot repo. */
export function vaultDataDir(vaultId: string): string {
  return path.join(app.getPath('userData'), 'vaults', vaultId)
}
