import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppSettings } from '@shared/types'
import { readHeader } from '@shared/page'
import { parseLinkTarget } from '@shared/wikilinks'
import { blockSection, headingSection, stripBlockId } from '@shared/blockrefs'
import { invoke } from './api'
import { runCommand } from './commands'
import { FolderView } from './components/FolderView'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CommandPalette } from './components/CommandPalette'
import { FindBar } from './components/FindBar'
import { Outline } from './components/Outline'
import { InfoPopover } from './components/InfoPopover'
import { PageView, type SaveStatus } from './components/PageView'
import { SheetHost } from './components/Sheets'
import { SIDEBAR_MAX, SIDEBAR_MIN, Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { SearchView, TagsView, TrashView } from './components/Views'
import { GraphView } from './components/GraphView'
import { Welcome } from './components/Welcome'
import { Toast } from './components/Toast'
import { SidePane } from './components/SidePane'
import { editorBridge } from './editor/bridge'
import { EmbeddedTable } from './components/EmbeddedTable'
import { useIpcEvent, usePresence } from './lib/hooks'
import i18next from './i18n'
import { createSpring } from './lib/spring'
import { announceReady, startupSheets } from './lib/updates'
import { applyMoves, linkTargetExists, useStore } from './store'

const WIDTH_KEY = 'sidebar:width'

function debounce(fn: () => void, ms: number): () => void {
  let id: ReturnType<typeof setTimeout> | undefined
  return () => {
    clearTimeout(id)
    id = setTimeout(fn, ms)
  }
}

const FONTS: Record<AppSettings['editorFont'], string> = {
  sans: 'var(--font-ui)',
  serif: "ui-serif, 'New York', Georgia, serif",
  mono: 'var(--font-mono)'
}
const WIDTHS: Record<AppSettings['editorWidth'], string> = {
  narrow: '600px',
  normal: '720px',
  wide: '920px',
  full: '100vw'
}

/** Editor appearance from the settings, as CSS variables on the root element. */
function applyAppearance(s: AppSettings): void {
  const root = document.documentElement.style
  root.setProperty('--editor-font', FONTS[s.editorFont] ?? FONTS.sans)
  root.setProperty('--editor-size', `${s.editorFontSize}px`)
  root.setProperty('--column', WIDTHS[s.editorWidth] ?? WIDTHS.normal)
  if (s.editorFont === 'sans') root.removeProperty('--editor-heading-font')
  else root.setProperty('--editor-heading-font', FONTS[s.editorFont])
}

function currentPage(): string | null {
  const v = useStore.getState().view
  return v.kind === 'page' ? v.path : null
}

// Wire editor node views to the store
editorBridge.TableBlock = EmbeddedTable
editorBridge.openTitle = (title, beside) => {
  const s = useStore.getState()
  // ⌘-click opens the link in the other pane (beside the main view, or back on the left)
  const pane = beside ? (s.side && s.activePane === 'side' ? 'main' : 'side') : undefined
  void s.openByTitle(title, pane)
}
editorBridge.useTitleExists = function useTitleExists(title: string): boolean {
  return useStore((s) => linkTargetExists(s.titleKeys, title))
}
editorBridge.resolveImage = async (target) => {
  const page = currentPage()
  if (!page) return null
  const rel = await invoke('page:resolveEmbed', page, target).catch(() => null)
  return rel ? 'vault-asset://vault/' + rel.split('/').map(encodeURIComponent).join('/') : null
}
editorBridge.loadPage = async (target) => {
  const { page, heading, block } = parseLinkTarget(target)
  const path = page ? await invoke('index:resolve', page).catch(() => null) : currentPage()
  if (!path) return null
  const file = await invoke('page:read', path).catch(() => null)
  if (!file) return null
  const header = readHeader(path, file.text)
  if (block) {
    // A block that is gone shows as missing rather than as the whole page
    const section = blockSection(header.body, block)
    return section === null ? null : { path, title: header.title, text: section.trim() }
  }
  const body = heading ? headingSection(header.body, heading) : header.body
  // Block ids are anchors, not text
  const text = body
    .split('\n')
    .map((l) => stripBlockId(l))
    .join('\n')
    .trim()
  return { path, title: header.title, text: text.length > 1200 ? text.slice(0, 1200) + ' …' : text }
}

export function App(): React.JSX.Element {
  const { t } = useTranslation()
  const view = useStore((s) => s.view)
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  const infoOpen = useStore((s) => s.infoOpen)
  const accent = useStore((s) => s.accent)
  const settings = useStore((s) => s.settings)
  const focusMode = useStore((s) => s.focusMode)
  const outlineOpen = useStore((s) => s.outlineOpen)
  const side = useStore((s) => s.side)
  const findHere = useStore((s) => s.activePane === 'main')
  const outline = usePresence(outlineOpen && view.kind === 'page', 160)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [scrolled, setScrolled] = useState(false)
  const appRef = useRef<HTMLDivElement>(null)
  const openWidth = useRef(readWidth())

  useEffect(() => void useStore.getState().init(), [])

  useEffect(() => {
    if (accent) document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  useEffect(() => {
    if (settings) applyAppearance(settings)
  }, [settings])

  const refreshTree = useMemo(() => debounce(() => void useStore.getState().refreshTree(), 120), [])
  const refreshIndex = useMemo(
    () => debounce(() => void useStore.getState().refreshIndexData(), 250),
    []
  )

  useIpcEvent('vault:changed', (v) => void useStore.getState().setVault(v))
  useIpcEvent('tree:changed', refreshTree)
  useIpcEvent('index:updated', refreshIndex)
  useIpcEvent('index:status', (indexStatus) => useStore.setState({ indexStatus }))
  useIpcEvent('conflicts:changed', (conflicts) => useStore.setState({ conflicts }))
  useIpcEvent('menu:command', (id) => void runCommand(id))
  useIpcEvent('app:accentColor', (accent) => useStore.setState({ accent }))
  useIpcEvent('page:moved', (moves) => {
    applyMoves(moves)
    refreshTree()
  })
  // Updates: the sidebar shows the state; a finished download is announced once
  useEffect(() => {
    void invoke('update:status').then((update) => {
      useStore.setState({ update })
      if (update.state === 'ready') announceReady(update.version)
    })
  }, [])
  useIpcEvent('update:status', (update) => {
    const was = useStore.getState().update
    useStore.setState({ update })
    if (update.state === 'ready' && was.state !== 'ready') announceReady(update.version)
  })
  // Once a vault is open (sheets need the main window): what's new, or the update question
  const shell = view.kind !== 'loading' && view.kind !== 'welcome'
  useEffect(() => {
    if (shell) void startupSheets()
  }, [shell])

  useIpcEvent('settings:changed', (next) => {
    useStore.setState({ settings: next })
    void invoke('app:language').then((lng) => {
      if (lng !== i18next.language) void i18next.changeLanguage(lng)
    })
  })
  // Before the window closes or the app quits: save what is still pending
  useIpcEvent('app:flush', (id) => {
    void useStore
      .getState()
      .flushAll()
      .catch(() => undefined)
      .finally(() => void invoke('app:flushed', id))
  })

  // Sidebar width is a spring so toggling can be interrupted and reversed mid-flight
  const spring = useMemo(
    () =>
      createSpring(sidebarVisible ? openWidth.current : 0, (v) => {
        appRef.current?.style.setProperty('--sb', `${Math.max(0, v)}px`)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  // Focus mode hides the sidebar without changing its remembered state
  const showSidebar = sidebarVisible && !focusMode
  useEffect(() => {
    spring.to(showSidebar ? openWidth.current : 0, { damping: 1, response: 0.32 })
  }, [showSidebar, spring])

  const setAppEl = useCallback(
    (el: HTMLDivElement | null) => {
      appRef.current = el
      el?.style.setProperty('--sb', `${Math.max(0, spring.value)}px`)
    },
    [spring]
  )

  const onResize = (w: number, live: boolean): void => {
    openWidth.current = w
    appRef.current?.style.setProperty('--sidebar-open-w', `${Math.max(SIDEBAR_MIN, w)}px`)
    spring.set(w)
    if (!live) {
      try {
        localStorage.setItem(
          WIDTH_KEY,
          String(Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w))))
        )
      } catch {
        // per-viewer convenience only
      }
    }
  }

  if (view.kind === 'loading') return <div className="app" />
  if (view.kind === 'welcome') {
    return (
      <>
        <Welcome />
        <Toast />
      </>
    )
  }

  return (
    <div
      ref={setAppEl}
      className={[
        'app',
        !showSidebar && 'sidebar-hidden',
        focusMode && 'focus-mode',
        outlineOpen && view.kind === 'page' && 'outline-open',
        side && !findHere && 'side-active'
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--sidebar-open-w' as string]: `${openWidth.current}px` }}
    >
      <Sidebar width={openWidth.current} onResize={onResize} />
      <main
        className={`main ${scrolled ? 'scrolled' : ''}`}
        onPointerDownCapture={() => useStore.getState().setActivePane('main')}
        onFocusCapture={() => useStore.getState().setActivePane('main')}
      >
        <Toolbar status={status} />
        <div
          className="main-scroll pane-scroll"
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
        >
          <ErrorBoundary resetKey={JSON.stringify(view)}>
            {view.kind === 'page' && <PageView path={view.path} onStatus={setStatus} />}
            {view.kind === 'folder' && <FolderView folder={view.folder} />}
            {view.kind === 'search' && (
              <SearchView key={`${view.tag}`} query={view.query} tag={view.tag} />
            )}
            {view.kind === 'tags' && <TagsView />}
            {view.kind === 'trash' && <TrashView />}
            {view.kind === 'graph' && <GraphView center={view.center} />}
            {view.kind === 'empty' && <div className="center-message">{t('page.emptyHint')}</div>}
          </ErrorBoundary>
        </div>
        {infoOpen && view.kind === 'page' && <InfoPopover path={view.path} />}
        {view.kind === 'page' && findHere && <FindBar />}
        {outline.mounted && view.kind === 'page' && <Outline closing={outline.closing} />}
      </main>
      {side && <SidePane path={side} />}
      <CommandPalette />
      <SheetHost />
      <Toast />
    </div>
  )
}

function readWidth(): number {
  try {
    const w = Number(localStorage.getItem(WIDTH_KEY))
    if (w >= SIDEBAR_MIN && w <= SIDEBAR_MAX) return w
  } catch {
    // ignore
  }
  return 264
}
