import {
  BrowserWindow,
  app,
  dialog,
  globalShortcut,
  ipcMain,
  net,
  nativeTheme,
  powerMonitor,
  protocol,
  shell,
  systemPreferences
} from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  type IpcArgs,
  type IpcChannel,
  type IpcEvents,
  type IpcResults,
  ipcSchemas
} from '@shared/ipc'
import type { IndexStatus, VaultInfo, VaultState } from '@shared/types'
import { createI18n, localeOf, resolveLanguage, type Language } from '@shared/i18n'
import type { CommandId } from '@shared/keymap'
import { env } from './env'
import { exportPage } from './export'
import { createGlassService } from './glass'
import { IndexClient } from './indexClient'
import { buildMenu } from './menu'
import { loadSettings, saveSettings, vaultDataDir } from './settings'
import { Vault } from './vault'
import { createUpdater, type Updater } from './updates'
import { createCaptureWindow, createMainWindow, showCapture } from './windows'
import { compareVersions } from '@shared/changelog'

const userData = env('USER_DATA')
if (userData) app.setPath('userData', userData)
app.setName('Write')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vault-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

const i18n = createI18n()
const t = i18n.t.bind(i18n)
const glass = createGlassService()

const mainWindows = new Set<BrowserWindow>()
let lastFocused: BrowserWindow | null = null
let captureWindow: BrowserWindow | null = null
let language: Language = 'de'

/** The main window commands and dialogs belong to: the focused one, else the last focused. */
function mainWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && mainWindows.has(focused)) return focused
  if (lastFocused && !lastFocused.isDestroyed()) return lastFocused
  return mainWindows.values().next().value ?? null
}
let current: Vault | null = null
let indexStatus: IndexStatus = { state: 'idle', done: 0, total: 0 }

const emit = <E extends keyof IpcEvents>(event: E, ...args: IpcEvents[E]): void => {
  for (const w of BrowserWindow.getAllWindows())
    if (!w.isDestroyed()) w.webContents.send(event, ...args)
}

const index = new IndexClient({
  status: (s) => {
    indexStatus = s
    emit('index:status', s)
  },
  updated: () => emit('index:updated')
})

function vault(): Vault {
  if (!current) throw new Error('Kein Vault geöffnet')
  return current
}

async function vaultState(): Promise<VaultState> {
  const s = await loadSettings()
  return { vaults: s.vaults, current: current?.info ?? null }
}

async function openVault(info: VaultInfo): Promise<VaultState> {
  if (current?.info.id === info.id) return vaultState()
  if (!existsSync(info.path)) throw new Error(t('error.vaultMissing', { path: info.path }))
  await current?.close()
  const s = await loadSettings()
  const v = new Vault(info, {
    dataDir: vaultDataDir(info.id),
    index,
    emit,
    snapshotDelayMs: () => s.settings.snapshotDelayMs,
    trashRetentionDays: () => s.settings.trashRetentionDays,
    historyRetentionDays: () => s.settings.historyRetentionDays,
    locale: () => localeOf(language)
  })
  await v.open()
  current = v
  await saveSettings((st) => {
    st.lastVaultId = info.id
  })
  const state = await vaultState()
  emit('vault:changed', state)
  return state
}

/** Registers a folder as vault (reading its id from `.docuapp/vault.json`) and opens it. */
async function addVault(folder: string): Promise<VaultState> {
  const { ensureVaultConfig } = await import('./vault')
  const cfg = await ensureVaultConfig(folder, path.basename(folder))
  const info: VaultInfo = { id: cfg.id, name: cfg.name || path.basename(folder), path: folder }
  await saveSettings((s) => {
    s.vaults = [...s.vaults.filter((v) => v.id !== info.id && v.path !== folder), info]
  })
  return openVault(info)
}

function defaultVaultLocation(): string {
  const icloud = path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs')
  return path.join(existsSync(icloud) ? icloud : app.getPath('documents'), 'Write')
}

// ── IPC ──────────────────────────────────────────────────────────────────────

function handle<C extends IpcChannel>(
  channel: C,
  fn: (...args: IpcArgs<C>) => Promise<IpcResults[C]> | IpcResults[C]
): void {
  ipcMain.handle(channel, async (event, ...raw: unknown[]) => {
    const url = event.senderFrame?.url ?? ''
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (!url.startsWith('file://') && !(devUrl && url.startsWith(devUrl)))
      throw new Error('Unerlaubter Absender')
    const args = ipcSchemas[channel].parse(raw) as IpcArgs<C>
    return fn(...args)
  })
}

function registerIpc(): void {
  handle('vault:state', vaultState)
  handle('vault:create', async () => {
    const res = await dialog.showSaveDialog(mainWindow()!, {
      title: t('vault.createTitle'),
      buttonLabel: t('vault.createButton'),
      nameFieldLabel: t('vault.nameLabel'),
      defaultPath: defaultVaultLocation(),
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })
    if (res.canceled || !res.filePath) return vaultState()
    mkdirSync(res.filePath, { recursive: true })
    return addVault(res.filePath)
  })
  handle('vault:openDialog', async () => {
    const res = await dialog.showOpenDialog(mainWindow()!, {
      title: t('vault.openTitle'),
      buttonLabel: t('vault.openButton'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return vaultState()
    return addVault(res.filePaths[0])
  })
  handle('vault:switch', async (id) => {
    const info = (await loadSettings()).vaults.find((v) => v.id === id)
    if (!info) throw new Error('Unbekannter Vault')
    return openVault(info)
  })
  handle('vault:forget', async (id) => {
    if (current?.info.id === id) throw new Error(t('error.forgetCurrent'))
    await saveSettings((s) => {
      const index = s.vaults.findIndex((v) => v.id === id)
      if (index >= 0) lastForgotten = { info: s.vaults[index]!, index }
      s.vaults = s.vaults.filter((v) => v.id !== id)
    })
    return vaultState()
  })
  // Undo for "remove from list": only the vault just removed comes back, at its old place
  handle('vault:unforget', async (id) => {
    const entry = lastForgotten
    if (entry?.info.id !== id) return vaultState()
    lastForgotten = null
    await saveSettings((s) => {
      if (!s.vaults.some((v) => v.id === id))
        s.vaults.splice(Math.min(entry.index, s.vaults.length), 0, entry.info)
    })
    return vaultState()
  })
  handle('vault:notices', () => current?.getNotices() ?? [])
  handle('vault:favorites', () => current?.favorites() ?? [])
  handle('vault:setFavorite', (rel, on) => vault().setFavorite(rel, on))

  handle('tree:get', () => (current ? current.tree() : []))
  handle('page:read', (rel) => vault().read(rel))
  handle('page:write', (rel, text, baseHash) => vault().write(rel, text, baseHash))
  handle('page:create', (parent, title, body) => vault().create(parent, title, body))
  handle('folder:create', (parent, name) => vault().createFolder(parent, name))
  handle('folder:rename', (rel, name) => vault().renameFolder(rel, name))
  handle('page:rename', (rel, title) => vault().rename(rel, title))
  handle('page:move', (rel, parent) => vault().move(rel, parent))
  handle('page:trash', (rel) => vault().trashPage(rel))
  handle('folder:trash', (rel) => vault().trashFolder(rel))
  handle('page:reveal', (rel) => shell.showItemInFolder(vault().abs(rel)))
  handle('page:openLink', async (url) => {
    if (/^(https?|mailto):/.test(url)) await shell.openExternal(url)
  })
  handle('asset:save', (rel, name, bytes) => vault().saveAsset(rel, name, bytes))
  handle('page:linkMentions', (rel, title) => vault().linkMentions(rel, title))
  handle('page:resolveEmbed', (rel, target) => vault().resolveEmbed(rel, target))
  handle('page:export', async (req) => {
    try {
      const target = await exportPage(req, mainWindow(), (rel) => vault().abs(rel), {
        pdfTitle: t('export.pdfTitle'),
        htmlTitle: t('export.htmlTitle')
      })
      if (target) shell.showItemInFolder(target)
      return target
    } catch (err) {
      throw new Error(t('error.exportFailed', { message: (err as Error).message }), { cause: err })
    }
  })
  handle('folder:move', (rel, parent) => vault().moveFolder(rel, parent))
  handle('tree:setOrder', (dir, names) => vault().setOrder(dir, names))
  handle('window:open', (page) => {
    const from = mainWindow()?.getBounds()
    createWindow(from && { ...from, x: from.x + 28, y: from.y + 28 }, page)
  })

  handle('index:titles', () => (current ? index.titles() : []))
  handle('index:search', (q, tag) => index.search(q, tag))
  handle('index:backlinks', (rel) => index.backlinks(rel))
  handle('index:mentions', (rel) => index.mentions(rel))
  handle('index:tags', () => (current ? index.tags() : []))
  handle('index:graph', () =>
    current ? index.graph() : Promise.resolve({ pages: [], links: [], ghosts: [] })
  )
  handle('index:summaries', (paths) => (current ? index.summaries(paths) : []))
  handle('index:resolve', (title) => index.resolve(title))
  handle('index:rebuild', () => index.rebuild())
  handle('index:status', () => indexStatus)

  handle('history:list', (rel) => vault().history.log(rel))
  handle('history:read', (rel, oid) => vault().history.read(rel, oid))
  handle('history:restore', async (rel, oid) => {
    const v = vault()
    const text = await v.history.read(rel, oid)
    await v.history.snapshot([rel], 'Vor dem Wiederherstellen')
    await v.write(rel, text, null)
    emit('page:changed', rel)
  })

  handle('trash:list', () => vault().trash.list())
  handle('trash:restore', (id) => vault().restoreFromTrash(id))
  handle('trash:delete', (id) => vault().trash.remove(id))
  handle('trash:empty', () => vault().trash.empty())

  handle('conflicts:list', () => current?.getConflicts() ?? [])
  handle('conflicts:read', (rel) => vault().readConflict(rel))
  handle('conflicts:resolve', (rel, action) => vault().resolveConflict(rel, action))

  handle('journal:today', () => vault().journalToday())
  handle('journal:day', (day) => vault().journalDay(day))
  handle('capture:append', async (text) => {
    await vault().captureAppend(text)
  })
  handle('capture:hide', () => {
    captureWindow?.hide()
  })

  handle('templates:list', () => (current ? current.templates() : []))
  handle('templates:render', (rel, title) => vault().renderTemplate(rel, title))

  handle('settings:get', async () => (await loadSettings()).settings)
  handle('settings:set', async (patch) => {
    const before = (await loadSettings()).settings
    if (patch.captureShortcut && patch.captureShortcut !== before.captureShortcut) {
      if (!registerCaptureShortcut(patch.captureShortcut)) {
        registerCaptureShortcut(before.captureShortcut)
        throw new Error('error.shortcutTaken')
      }
    }
    const s = await saveSettings((st) => Object.assign(st.settings, patch))
    if (patch.language) await applyLanguage(patch.language)
    // Native glass, the capture panel and every window's CSS follow this together
    if (patch.theme) nativeTheme.themeSource = patch.theme
    if (patch.autoUpdates && patch.autoUpdates !== before.autoUpdates)
      scheduleUpdateChecks(patch.autoUpdates, true)
    emit('settings:changed', s.settings)
    return s.settings
  })
  handle('update:status', () => updater?.status() ?? { state: 'disabled' })
  handle('update:check', () => updater?.check() ?? { state: 'disabled' })
  handle('update:install', () => updater?.install())
  handle('update:shouldAsk', async () => {
    if (env('ASK_UPDATES') === '1') return true
    const s = await loadSettings()
    return (
      updater?.status().state !== 'disabled' &&
      s.settings.autoUpdates === 'ask' &&
      (s.launches ?? 0) >= 2
    )
  })
  handle('app:licenses', async () => {
    try {
      return await readFile(
        path.join(import.meta.dirname, '../renderer/third-party-licenses.txt'),
        'utf8'
      )
    } catch {
      return null
    }
  })
  // After an update, the renderer shows what changed since the version used last time
  handle('app:whatsNew', async () => {
    const version = app.getVersion()
    const prev = (await loadSettings()).seenVersion ?? null
    if (prev !== version) await saveSettings((s) => (s.seenVersion = version))
    return { version, since: prev && compareVersions(version, prev) > 0 ? prev : null }
  })
  handle('app:paths', () => ({
    vault: current?.root ?? null,
    data: current ? vaultDataDir(current.info.id) : null,
    version: app.getVersion()
  }))
  handle('app:revealPath', async (which) => {
    const p = which === 'vault' ? current?.root : current ? vaultDataDir(current.info.id) : null
    if (p) await shell.openPath(p)
  })
  handle('app:accentColor', accentColor)
  handle('app:language', () => language)
  handle('app:flushed', (id) => {
    flushWaiters.get(id)?.()
    flushWaiters.delete(id)
  })
}

async function applyLanguage(setting: string): Promise<void> {
  language = resolveLanguage(setting, app.getLocale())
  await i18n.changeLanguage(language)
  buildMenu(t, mainWindow, onMenuCommand)
}

// ── Saving before close/quit ─────────────────────────────────────────────────

let flushId = 0
const flushWaiters = new Map<number, () => void>()

/** Asks a window to save pending edits and waits for it (at most a few seconds). */
function flushWindow(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed() || win.webContents.isCrashed() || win.webContents.isLoading())
    return Promise.resolve()
  const id = ++flushId
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      flushWaiters.delete(id)
      resolve()
    }, 4000)
    flushWaiters.set(id, () => {
      clearTimeout(timer)
      resolve()
    })
    win.webContents.send('app:flush', id)
  })
}

/** Swaps the global Quick Capture shortcut; returns false if macOS or another app owns it. */
let captureShortcut: string | null = null
let lastForgotten: { info: VaultInfo; index: number } | null = null
let updater: Updater | null = null
let updateTimers: NodeJS.Timeout[] = []

/**
 * Background checks only with the user's permission (each one contacts GitHub). Manual checks
 * from the menu or the settings work regardless.
 */
function scheduleUpdateChecks(mode: 'ask' | 'on' | 'off', now = false): void {
  for (const t of updateTimers) clearTimeout(t)
  updateTimers = []
  if (mode !== 'on') return
  updateTimers.push(
    setTimeout(() => void updater?.check(), now ? 0 : 5000),
    setInterval(() => void updater?.check(), 24 * 60 * 60 * 1000)
  )
}
function registerCaptureShortcut(accelerator: string): boolean {
  if (captureShortcut) globalShortcut.unregister(captureShortcut)
  captureShortcut = null
  try {
    if (!globalShortcut.register(accelerator, openCapture)) return false
  } catch {
    return false
  }
  captureShortcut = accelerator
  return true
}

function accentColor(): string | null {
  try {
    const c = systemPreferences.getAccentColor()
    return c ? `#${c.slice(0, 6)}` : null
  } catch {
    return null
  }
}

function openCapture(): void {
  if (!current) {
    mainWindow()?.show()
    return
  }
  if (!captureWindow || captureWindow.isDestroyed()) captureWindow = createCaptureWindow(glass)
  showCapture(captureWindow)
}

function onMenuCommand(id: CommandId): boolean {
  if (id === 'capture.open') {
    openCapture()
    return true
  }
  return false
}

function createWindow(
  bounds?: { x: number; y: number; width: number; height: number },
  page?: string
): BrowserWindow {
  const win = createMainWindow(glass, bounds, page)
  let flushed = false
  win.on('close', (e) => {
    // Save the open page first; the editor saves with a short delay after typing
    if (flushed) return
    e.preventDefault()
    void flushWindow(win).finally(() => {
      flushed = true
      if (!win.isDestroyed()) win.close()
    })
  })
  let saveTimer: NodeJS.Timeout | null = null
  const persist = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!win.isDestroyed() && !win.isFullScreen())
        void saveSettings((s) => (s.windowBounds = win.getBounds()))
    }, 500)
  }
  win.on('resize', persist)
  win.on('move', persist)
  win.on('focus', () => {
    lastFocused = win
    emit('app:accentColor', accentColor())
  })
  win.on('closed', () => {
    mainWindows.delete(win)
    if (lastFocused === win) lastFocused = null
  })
  mainWindows.add(win)
  lastFocused = win
  return win
}

app.whenReady().then(async () => {
  const settings = await loadSettings()

  protocol.handle('vault-asset', (req) => {
    try {
      const url = new URL(req.url)
      const rel = url.pathname.split('/').filter(Boolean).map(decodeURIComponent).join('/')
      return net.fetch(pathToFileURL(vault().abs(rel)).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  language = resolveLanguage(settings.settings.language, app.getLocale())
  await i18n.changeLanguage(language)
  registerIpc()
  if (!app.isPackaged && process.platform === 'darwin') {
    // The packaged bundle carries the icon itself; in development show it in the Dock too
    app.dock?.setIcon(path.join(import.meta.dirname, '../../resources/icon.png'))
  }
  buildMenu(t, mainWindow, onMenuCommand)
  nativeTheme.themeSource = settings.settings.theme

  // The Quick Capture panel (a non-activating NSPanel) is prepared only after the main window
  // is up and the app is active, so it can't interfere with activation at launch. It still
  // exists long before anyone presses the shortcut; openCapture() creates it on demand anyway.
  createWindow(settings.windowBounds).once('show', () =>
    setTimeout(() => {
      if (!captureWindow || captureWindow.isDestroyed()) captureWindow = createCaptureWindow(glass)
    }, 1500)
  )

  if (!registerCaptureShortcut(settings.settings.captureShortcut))
    console.warn('[capture] Kurzbefehl belegt:', settings.settings.captureShortcut)

  try {
    const devVault = env('VAULT')
    if (devVault) await addVault(path.resolve(devVault))
    else {
      const last = settings.vaults.find((v) => v.id === settings.lastVaultId)
      if (last) await openVault(last)
    }
  } catch (err) {
    console.error('[vault] Öffnen fehlgeschlagen', err)
  }

  updater = await createUpdater({
    enabled: app.isPackaged && !env('NO_UPDATES'),
    emit: (status) => emit('update:status', status),
    beforeInstall: shutdown
  })
  await saveSettings((s) => (s.launches = (s.launches ?? 0) + 1))
  scheduleUpdateChecks(settings.settings.autoUpdates)

  // Shutting down or logging out quits every app. Holding that quit back in before-quit makes
  // macOS cancel the shutdown ("Write interrupted shutdown"); claiming it here instead tells
  // Electron to keep the system waiting until we quit on our own.
  powerMonitor.on('shutdown', ((e: Electron.Event) => {
    if (quitting) return
    e.preventDefault()
    void shutdown().finally(() => app.quit())
  }) as () => void)

  app.on('activate', () => {
    const win = mainWindow()
    if (!win) createWindow(settings.windowBounds ?? undefined)
    else {
      if (win.isMinimized()) win.restore()
      win.show()
    }
  })
})

let quitting = false
/**
 * Pending edits first (each window answers within 4 s), then snapshots and the index; afterwards
 * windows close without asking. The edits are what matters – they are on disk once the windows
 * have flushed. Finishing the version history (a large snapshot or the daily cleanup may be
 * running) gets a few seconds more, but never keeps the app from quitting or updating.
 */
const HISTORY_GRACE_MS = 5000
async function shutdown(): Promise<void> {
  quitting = true
  await Promise.all([...mainWindows].map(flushWindow)).catch(() => undefined)
  let timer: NodeJS.Timeout | undefined
  const gaveUp = await Promise.race([
    Promise.resolve(current?.close())
      .catch(() => undefined)
      .then(() => false),
    new Promise<boolean>((resolve) => (timer = setTimeout(() => resolve(true), HISTORY_GRACE_MS)))
  ])
  clearTimeout(timer)
  if (gaveUp) console.warn('[quit] Versionsgeschichte nicht rechtzeitig fertig, beende trotzdem')
  index.close()
  for (const w of mainWindows) w.removeAllListeners('close')
}

app.on('before-quit', (e) => {
  if (quitting) return
  e.preventDefault()
  void shutdown().finally(() => app.quit())
})

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  // macOS: the app stays alive for Quick Capture and the Dock icon
  if (process.platform !== 'darwin') app.quit()
})
