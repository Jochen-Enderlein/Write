import type { EditorView } from 'prosemirror-view'
import { create } from 'zustand'
import type {
  AppSettings,
  ConflictInfo,
  IndexStatus,
  PageMeta,
  TagCount,
  TreeNode,
  UpdateStatus,
  VaultNotice,
  VaultState
} from '@shared/types'
import { normalizeTitle, parseLinkTarget } from '@shared/wikilinks'
import { errorMessage, invoke } from './api'
import { t } from './i18n'

export type View =
  | { kind: 'loading' }
  | { kind: 'welcome' }
  | { kind: 'empty' }
  | { kind: 'page'; path: string }
  /** Overview of a plain folder (no page of its own). */
  | { kind: 'folder'; folder: string }
  | { kind: 'search'; query: string; tag: string | null }
  | { kind: 'tags' }
  | { kind: 'trash' }

export type PaletteMode = 'all' | 'pages' | 'templates' | 'vaults' | 'move'

export type Sheet =
  | null
  | { kind: 'history'; path: string }
  | { kind: 'conflicts' }
  | { kind: 'compare'; path: string; mine: string; theirs: string }
  | { kind: 'settings' }
  | { kind: 'shortcuts' }
  /** Release notes; `since` = last version used, null shows the current version only. */
  | { kind: 'whatsNew'; since: string | null }

export interface HeadingInfo {
  id: string
  level: number
  text: string
}

/** Hooks the open editor registers so global commands can reach it. */
export interface EditorHandle {
  path: string
  flush(): Promise<void>
  insertMarkdown(md: string): void
  stats(): { words: number }
  headings(): HeadingInfo[]
  /** Scrolls to a block and puts the caret there. */
  scrollToBlock(id: string): void
  /** Scrolls to the first heading with this text; false if there is none. */
  scrollToHeading(text: string): boolean
  /** Changes frontmatter fields (`undefined` removes one) and saves. */
  updateFrontmatter(changes: Record<string, unknown>): void
  /** Self-contained HTML of the rendered page, for export and printing. */
  exportHtml(): string
  /** The ProseMirror view (find and replace). */
  view(): EditorView | null
}

const RECENT_MAX = 12
const OUTLINE_KEY = 'outline:open'

interface State {
  vault: VaultState | null
  tree: TreeNode[]
  titles: PageMeta[]
  titleIndex: Map<string, PageMeta>
  favorites: string[]
  tags: TagCount[]
  conflicts: ConflictInfo[]
  notices: VaultNotice[]
  indexStatus: IndexStatus
  view: View
  back: View[]
  forward: View[]
  sidebarVisible: boolean
  palette: { open: boolean; mode: PaletteMode }
  sheet: Sheet
  infoOpen: boolean
  toast: { id: number; text: string; action?: { label: string; run(): void } } | null
  update: UpdateStatus
  titleFocusToken: number
  /** The next editor that mounts should take focus (e.g. after Enter in the title). */
  pendingEditorFocus: boolean
  /** Tree node that should enter rename mode once it shows up (fresh folders). */
  pendingTreeEdit: string | null
  editor: EditorHandle | null
  accent: string | null
  settings: AppSettings | null
  /** Recently opened pages of this vault, newest first. */
  recent: string[]
  /** Normalised titles, file names and paths of all pages (fast link existence checks). */
  titleKeys: Set<string>
  /** Heading the next opened page should scroll to (`[[Seite#Abschnitt]]`). */
  pendingAnchor: string | null
  /** Text the find bar should search for when the next page opens (from full-text search). */
  pendingFind: string | null
  find: { open: boolean; replace: boolean; token: number; step: number }
  outlineOpen: boolean
  focusMode: boolean
  wordCount: number
  calendarOpen: boolean
  /** Bumped to open the icon picker of the open page. */
  iconPickerToken: number
  /** Bumped on every editor change (outline, word count). */
  docVersion: number

  init(): Promise<void>
  setVault(v: VaultState, initialPage?: string | null): Promise<void>
  refreshTree(): Promise<void>
  refreshIndexData(): Promise<void>
  refreshFavorites(): Promise<void>
  navigate(v: View, opts?: { replace?: boolean }): void
  goBack(): void
  goForward(): void
  openPage(path: string): void
  openByTitle(title: string): Promise<void>
  newPage(parent?: string, title?: string, body?: string): Promise<void>
  newFolder(parent?: string): Promise<void>
  renameFolder(path: string, name: string): Promise<void>
  renamePage(path: string, title: string): Promise<string | null>
  movePage(path: string, parent: string): Promise<string | null>
  moveFolder(path: string, parent: string): Promise<string | null>
  trashPage(path: string): Promise<void>
  trashFolder(path: string): Promise<void>
  restoreFromTrash(id: string, title: string): Promise<void>
  toggleFavorite(path: string): Promise<void>
  openJournal(): Promise<void>
  setPalette(open: boolean, mode?: PaletteMode): void
  setSheet(s: Sheet): void
  setInfoOpen(open: boolean): void
  toggleSidebar(): void
  notify(text: string, action?: { label: string; run(): void }): void
  fail(err: unknown): void
  setEditor(h: EditorHandle | null): void
  requestTitleFocus(): void
  openJournalDay(day: string): Promise<void>
  openInNewWindow(path: string): Promise<void>
  openFind(replace: boolean): void
  stepFind(dir: 1 | -1): void
  closeFind(): void
  toggleOutline(): void
  toggleFocusMode(): void
  updateSettings(patch: Partial<AppSettings>): Promise<void>
}

let toastId = 0

export const useStore = create<State>((set, get) => ({
  vault: null,
  tree: [],
  titles: [],
  titleIndex: new Map(),
  favorites: [],
  tags: [],
  conflicts: [],
  notices: [],
  indexStatus: { state: 'idle', done: 0, total: 0 },
  view: { kind: 'loading' },
  back: [],
  forward: [],
  sidebarVisible: true,
  palette: { open: false, mode: 'all' },
  sheet: null,
  infoOpen: false,
  toast: null,
  update: { state: 'idle' },
  titleFocusToken: 0,
  pendingEditorFocus: false,
  pendingTreeEdit: null,
  editor: null,
  accent: null,
  settings: null,
  recent: [],
  titleKeys: new Set(),
  pendingAnchor: null,
  pendingFind: null,
  find: { open: false, replace: false, token: 0, step: 0 },
  outlineOpen: readFlag(OUTLINE_KEY),
  focusMode: false,
  wordCount: 0,
  calendarOpen: false,
  iconPickerToken: 0,
  docVersion: 0,

  async init() {
    const [vault, accent, settings] = await Promise.all([
      invoke('vault:state'),
      invoke('app:accentColor'),
      invoke('settings:get')
    ])
    set({ accent, settings })
    // A window opened with "Open in New Window" starts on that page
    const initial = new URLSearchParams(location.search).get('page')
    await get().setVault(vault, initial)
  },

  async setVault(vault, initialPage) {
    set({ vault, back: [], forward: [] })
    if (!vault.current) {
      set({
        view: { kind: 'welcome' },
        tree: [],
        titles: [],
        titleIndex: new Map(),
        favorites: [],
        tags: []
      })
      return
    }
    const last = (() => {
      try {
        return localStorage.getItem(`lastPage:${vault.current.id}`)
      } catch {
        return null
      }
    })()
    const start = initialPage ?? last
    set({
      view: start ? { kind: 'page', path: start } : { kind: 'empty' },
      recent: readRecent(vault.current.id)
    })
    const [conflicts, notices, indexStatus] = await Promise.all([
      invoke('conflicts:list'),
      invoke('vault:notices'),
      invoke('index:status')
    ])
    set({ conflicts, notices, indexStatus })
    await Promise.all([get().refreshTree(), get().refreshIndexData(), get().refreshFavorites()])
    // Notices are computed in the background after opening
    setTimeout(() => void invoke('vault:notices').then((n) => set({ notices: n })), 2500)
  },

  async refreshTree() {
    try {
      set({ tree: await invoke('tree:get') })
    } catch (err) {
      get().fail(err)
    }
  },

  async refreshIndexData() {
    const [titles, tags] = await Promise.all([invoke('index:titles'), invoke('index:tags')])
    const titleIndex = new Map<string, PageMeta>()
    const titleKeys = new Set<string>()
    for (const m of titles) {
      titleIndex.set(m.path, m)
      const noExt = m.path.replace(/\.md$/i, '')
      titleKeys.add(normalizeTitle(m.title))
      titleKeys.add(normalizeTitle(noExt.replace(/^.*\//, '')))
      titleKeys.add(normalizeTitle(noExt))
    }
    set({ titles, tags, titleIndex, titleKeys })
  },

  async refreshFavorites() {
    set({ favorites: await invoke('vault:favorites') })
  },

  navigate(v, opts = {}) {
    const { view, back } = get()
    if (JSON.stringify(view) === JSON.stringify(v)) return
    const keep = view.kind !== 'loading' && view.kind !== 'welcome' && !opts.replace
    set({
      view: v,
      back: keep ? [...back.slice(-49), view] : back,
      forward: opts.replace ? get().forward : [],
      infoOpen: false,
      // The find bar belongs to one page; search results reopen it via `pendingFind`
      find: { ...get().find, open: false },
      calendarOpen: false
    })
    remember(v)
  },

  goBack() {
    const { back, view, forward } = get()
    const prev = back[back.length - 1]
    if (!prev) return
    set({
      view: prev,
      back: back.slice(0, -1),
      forward: [view, ...forward],
      infoOpen: false,
      find: { ...get().find, open: false }
    })
    remember(prev)
  },

  goForward() {
    const { back, view, forward } = get()
    const next = forward[0]
    if (!next) return
    set({
      view: next,
      forward: forward.slice(1),
      back: [...back, view],
      infoOpen: false,
      find: { ...get().find, open: false }
    })
    remember(next)
  },

  openPage(path) {
    get().navigate({ kind: 'page', path })
  },

  async openByTitle(target) {
    try {
      const { page, heading } = parseLinkTarget(target)
      const view = get().view
      // `[[#Abschnitt]]` points into the open page
      if (!page) {
        if (heading) get().editor?.scrollToHeading(heading)
        return
      }
      const path = await invoke('index:resolve', page)
      if (path && view.kind === 'page' && view.path === path) {
        if (heading) get().editor?.scrollToHeading(heading)
        return
      }
      set({ pendingAnchor: heading })
      if (path) get().openPage(path)
      else await get().newPage('', page.replace(/^.*\//, ''))
    } catch (err) {
      get().fail(err)
    }
  },

  async newPage(parent = '', title, body) {
    try {
      await get().editor?.flush()
      const path = await invoke('page:create', parent, title ?? t('page.untitled'), body)
      get().openPage(path)
      get().requestTitleFocus()
      void get().refreshTree()
    } catch (err) {
      get().fail(err)
    }
  },

  async newFolder(parent = '') {
    try {
      const path = await invoke('folder:create', parent, t('tree.untitledFolder'))
      set({ pendingTreeEdit: path, sidebarVisible: true })
      await get().refreshTree()
    } catch (err) {
      get().fail(err)
    }
  },

  async renameFolder(path, name) {
    if (!name.trim() || name.trim() === path.split('/').pop()) return
    try {
      await get().editor?.flush()
      await invoke('folder:rename', path, name.trim())
    } catch (err) {
      get().fail(err)
    }
  },

  async renamePage(path, title) {
    const current = get().titleIndex.get(path)?.title
    if (!title.trim() || title.trim() === current) return path
    try {
      if (get().editor?.path === path) await get().editor!.flush()
      const next = await invoke('page:rename', path, title.trim())
      return next
    } catch (err) {
      get().fail(err)
      return null
    }
  },

  async movePage(path, parent) {
    try {
      if (get().editor?.path === path) await get().editor!.flush()
      return await invoke('page:move', path, parent)
    } catch (err) {
      get().fail(err)
      return null
    }
  },

  async moveFolder(path, parent) {
    try {
      const view = get().view
      if (view.kind === 'page' && view.path.startsWith(path + '/')) await get().editor?.flush()
      return await invoke('folder:move', path, parent)
    } catch (err) {
      get().fail(err)
      return null
    }
  },

  async trashPage(path) {
    try {
      if (get().editor?.path === path) await get().editor!.flush()
      const title = titleOf(path)
      const id = await invoke('page:trash', path)
      get().notify(t('trash.moved', { title }), {
        label: t('trash.undo'),
        run: () => void get().restoreFromTrash(id, title)
      })
    } catch (err) {
      get().fail(err)
    }
  },

  async trashFolder(path) {
    try {
      const view = get().view
      if (view.kind === 'page' && view.path.startsWith(path + '/')) await get().editor?.flush()
      const title = path.split('/').pop()!
      const id = await invoke('folder:trash', path)
      get().notify(t('trash.moved', { title }), {
        label: t('trash.undo'),
        run: () => void get().restoreFromTrash(id, title)
      })
    } catch (err) {
      get().fail(err)
    }
  },

  async restoreFromTrash(id, title) {
    try {
      const restored = await invoke('trash:restore', id)
      get().notify(t('trash.restored', { title }))
      if (restored.kind === 'page') get().openPage(restored.path)
      else await get().refreshTree()
    } catch (err) {
      get().fail(err)
    }
  },

  async toggleFavorite(path) {
    try {
      const on = !get().favorites.includes(path)
      set({ favorites: await invoke('vault:setFavorite', path, on) })
    } catch (err) {
      get().fail(err)
    }
  },

  async openJournal() {
    try {
      const path = await invoke('journal:today')
      get().openPage(path)
    } catch (err) {
      get().fail(err)
    }
  },

  setPalette(open, mode = 'all') {
    set({ palette: { open, mode } })
  },
  setSheet(sheet) {
    set({ sheet })
  },
  setInfoOpen(infoOpen) {
    set({ infoOpen })
  },
  toggleSidebar() {
    set({ sidebarVisible: !get().sidebarVisible })
  },
  notify(text, action) {
    // Dismissal is timed by the Toast itself, so it can pause while the pointer rests on it
    set({ toast: { id: ++toastId, text, action } })
  },
  fail(err) {
    console.error(err)
    get().notify(errorMessage(err))
  },
  setEditor(editor) {
    set({ editor })
  },
  requestTitleFocus() {
    set({ titleFocusToken: get().titleFocusToken + 1 })
  },
  async openJournalDay(day) {
    try {
      get().openPage(await invoke('journal:day', day))
    } catch (err) {
      get().fail(err)
    }
  },
  async openInNewWindow(path) {
    try {
      if (get().editor?.path === path) await get().editor!.flush()
      await invoke('window:open', path)
    } catch (err) {
      get().fail(err)
    }
  },
  openFind(replace) {
    const f = get().find
    set({
      find: { ...f, open: true, replace: replace || (f.open && f.replace), token: f.token + 1 }
    })
  },
  stepFind(dir) {
    const f = get().find
    if (!f.open) return get().openFind(false)
    set({ find: { ...f, step: f.step + dir } })
  },
  closeFind() {
    set({ find: { ...get().find, open: false } })
  },
  toggleOutline() {
    const outlineOpen = !get().outlineOpen
    writeFlag(OUTLINE_KEY, outlineOpen)
    set({ outlineOpen })
  },
  toggleFocusMode() {
    const focusMode = !get().focusMode
    set({ focusMode })
    if (focusMode) get().notify(t('focus.hint'))
  },
  async updateSettings(patch) {
    try {
      set({ settings: await invoke('settings:set', patch) })
    } catch (err) {
      get().fail(err)
    }
  }
}))

/** Stores the last page per vault and keeps the "recently opened" list. */
function remember(v: View): void {
  const s = useStore.getState()
  const id = s.vault?.current?.id
  if (v.kind !== 'page' || !id) return
  const recent = [v.path, ...s.recent.filter((p) => p !== v.path)].slice(0, RECENT_MAX)
  useStore.setState({ recent })
  try {
    localStorage.setItem(`lastPage:${id}`, v.path)
    localStorage.setItem(`recent:${id}`, JSON.stringify(recent))
  } catch {
    // per-viewer convenience only
  }
}

function readRecent(vaultId: string): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(`recent:${vaultId}`) ?? '[]')
    return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    // per-viewer convenience only
  }
}

/** Applies path changes (rename/move/trash) to everything that remembers paths. */
export function applyMoves(moves: { from: string; to: string }[]): void {
  const s = useStore.getState()
  const map = new Map(moves.map((m) => [m.from, m.to]))
  const remap = (v: View): View | null => {
    // A renamed or moved folder: follow it via any file that moved out of it
    if (v.kind === 'folder') {
      for (const [from, to] of map) {
        if (!to || !from.startsWith(v.folder + '/')) continue
        const rest = from.slice(v.folder.length)
        if (to.endsWith(rest)) return { kind: 'folder', folder: to.slice(0, -rest.length) }
      }
      return v
    }
    if (v.kind !== 'page' || !map.has(v.path)) return v
    const to = map.get(v.path)!
    return to ? { kind: 'page', path: to } : null
  }
  const view = remap(s.view) ?? { kind: 'empty' as const }
  useStore.setState({
    view,
    back: s.back.map(remap).filter((v): v is View => v !== null),
    forward: s.forward.map(remap).filter((v): v is View => v !== null),
    favorites: s.favorites.map((f) => map.get(f) ?? f).filter(Boolean),
    recent: s.recent.map((p) => (map.has(p) ? map.get(p)! : p)).filter(Boolean)
  })
}

export function titleOf(path: string): string {
  const meta = useStore.getState().titleIndex.get(path)
  return meta?.title ?? path.split('/').pop()!.replace(/\.md$/i, '')
}

/** True if a wiki-link target (`Seite`, `Ordner/Seite`, `Seite#Abschnitt`) points to a page. */
export function linkTargetExists(keys: Set<string>, target: string): boolean {
  const page = normalizeTitle(parseLinkTarget(target).page)
  if (!page) return true // `[[#Abschnitt]]` points into the page itself
  if (keys.has(page)) return true
  if (!page.includes('/')) return false
  for (const k of keys) if (k.endsWith('/' + page)) return true
  return false
}

export function titleExists(title: string): boolean {
  return linkTargetExists(useStore.getState().titleKeys, title)
}
