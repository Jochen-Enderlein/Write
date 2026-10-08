import type { PropValue, TableConfig } from './properties'

export interface VaultInfo {
  id: string
  name: string
  path: string
}

export interface VaultState {
  vaults: VaultInfo[]
  current: VaultInfo | null
}

/** A node in the page tree. Paths are POSIX-style and relative to the vault root. */
export interface TreeNode {
  /** Unique id: the page's `.md` path, or the folder path for plain folders. */
  id: string
  name: string
  kind: 'page' | 'folder'
  /** Relative path of the markdown file (pages only). */
  path: string | null
  /** Relative path of the folder holding children and `_assets/`. */
  folder: string
  /** True while an iCloud placeholder is being downloaded. */
  placeholder?: boolean
  children?: TreeNode[]
}

export interface PageFile {
  path: string
  text: string
  hash: string
  mtimeMs: number
}

export type WriteResult =
  { ok: true; hash: string } | { ok: false; reason: 'conflict'; diskText: string; diskHash: string }

export interface PageMeta {
  path: string
  id: string | null
  title: string
  icon: string | null
  tags: string[]
}

export interface SearchHit {
  path: string
  title: string
  icon: string | null
  snippet: string
}

/** A page as shown on a folder overview card. */
export interface PageSummary {
  path: string
  title: string
  icon: string | null
  /** Start of the text, for a two-line preview. */
  snippet: string
  mtimeMs: number
}

/** A page as a row of a table: its properties come from the frontmatter. */
export interface TableRow {
  path: string
  title: string
  icon: string | null
  mtimeMs: number
  tags: string[]
  props: Record<string, PropValue>
}

/** A property key in use, with common values for suggestions. */
export interface PropKey {
  key: string
  count: number
  values: (string | number | boolean)[]
}

/** How a folder overview shows its pages; synced in vault.json. */
export interface FolderLayout {
  mode: 'cards' | 'table'
  table: TableConfig
}

/** Where the app is with updates; drives the sidebar notice and manual checks. */
export type UpdateStatus =
  | { state: 'disabled' } // development builds
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'current'; version: string }
  | { state: 'error'; message: string }

export interface TagCount {
  tag: string
  count: number
}

/** Pages and how they are connected, for the graph view. */
export interface GraphData {
  pages: { path: string; title: string; icon: string | null; tags: string[] }[]
  /** Resolved wiki-links as [source, target] indices into `pages`, without duplicates. */
  links: [number, number][]
  /** Link targets without a page yet, with the pages that link to them. */
  ghosts: { title: string; from: number[] }[]
}

export interface IndexStatus {
  state: 'idle' | 'indexing'
  done: number
  total: number
}

export interface HistoryEntry {
  oid: string
  timestamp: number
  message: string
}

export interface TrashEntry {
  id: string
  title: string
  originalPath: string
  deletedAt: string
  kind: 'page' | 'folder'
}

export interface ConflictInfo {
  conflictPath: string
  originalPath: string
}

export interface TemplateInfo {
  name: string
  path: string
}

export type EditorFont = 'sans' | 'serif' | 'mono'
export type EditorWidth = 'narrow' | 'normal' | 'wide' | 'full'
export type LanguageSetting = 'system' | 'de' | 'en'
export type ThemeSetting = 'system' | 'light' | 'dark'

export interface AppSettings {
  trashRetentionDays: number
  snapshotDelayMs: number
  captureShortcut: string
  /** Snapshots older than this are dropped; 0 keeps them forever. */
  historyRetentionDays: number
  editorFont: EditorFont
  editorFontSize: number
  editorWidth: EditorWidth
  language: LanguageSetting
  /** Light or dark appearance; `system` follows macOS. */
  theme: ThemeSetting
  /**
   * Daily update check at GitHub. Off until the user agrees (asked once on the second launch),
   * since every check tells GitHub the IP address; a manual check is always possible.
   */
  autoUpdates: 'ask' | 'on' | 'off'
  /** What AI assistants may do with the open vault through the MCP server. */
  mcpAccess: 'off' | 'read' | 'write'
}

/** How an AI assistant starts Write's MCP server. */
export interface McpLaunch {
  command: string
  args: string[]
  env: Record<string, string>
}

export interface VaultNotice {
  kind: 'notLocal'
  message: string
}
