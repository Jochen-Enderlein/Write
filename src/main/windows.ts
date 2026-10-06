import { BrowserWindow, app, screen, shell } from 'electron'
import path from 'node:path'
import type { GlassService } from './glass'

const preload = (): string => path.join(import.meta.dirname, '../preload/index.cjs')

function load(
  win: BrowserWindow,
  page: 'index' | 'capture',
  query: Record<string, string> = {}
): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  const search = new URLSearchParams(query).toString()
  if (!app.isPackaged && devUrl)
    void win.loadURL(`${devUrl}/${page}.html${search ? '?' + search : ''}`)
  else void win.loadFile(path.join(import.meta.dirname, `../renderer/${page}.html`), { query })
}

function harden(win: BrowserWindow): void {
  // External links open in the browser; the app window never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(process.env.ELECTRON_RENDERER_URL ?? 'file://')) e.preventDefault()
  })
}

export function createMainWindow(
  glass: GlassService,
  bounds?: { x: number; y: number; width: number; height: number },
  initialPage?: string
): BrowserWindow {
  const visible =
    bounds &&
    screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return (
        bounds.x < a.x + a.width &&
        bounds.x + bounds.width > a.x &&
        bounds.y < a.y + a.height &&
        bounds.y + bounds.height > a.y
      )
    })
  const win = new BrowserWindow({
    ...(visible ? bounds : { width: 1240, height: 820 }),
    minWidth: 640,
    minHeight: 420,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preload(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })
  harden(win)
  win.webContents.once('did-finish-load', () => {
    glass.apply(win)
    win.setWindowButtonVisibility(true)
  })
  win.once('ready-to-show', () => {
    win.show()
    // The window appears only once the renderer is ready, which can be a moment after launch.
    // Showing it doesn't make the app active by itself: the window would look focused while the
    // menu bar still belongs to the previous app. Ask macOS to activate us – cooperatively, so
    // the request is honoured right after a launch but never pulls focus from an app the user
    // switched to in the meantime.
    if (process.platform === 'darwin') app.focus()
  })
  load(win, 'index', initialPage ? { page: initialPage } : {})
  return win
}

/** Small floating glass panel for Quick Capture; created hidden at startup so it opens instantly. */
export function createCaptureWindow(glass: GlassService): BrowserWindow {
  const win = new BrowserWindow({
    width: 560,
    height: 188,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    type: 'panel',
    transparent: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preload(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  harden(win)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.webContents.once('did-finish-load', () => glass.apply(win, { cornerRadius: 26 }))
  win.on('blur', () => win.hide())
  load(win, 'capture')
  return win
}

export function showCapture(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint()
  const { workArea } = screen.getDisplayNearestPoint(cursor)
  const [w, h] = win.getSize() as [number, number]
  win.setPosition(
    Math.round(workArea.x + (workArea.width - w) / 2),
    Math.round(workArea.y + workArea.height * 0.24 - h / 2)
  )
  win.show()
  win.focus()
  win.webContents.send('capture:shown')
}
