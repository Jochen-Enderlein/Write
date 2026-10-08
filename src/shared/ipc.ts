import { z } from 'zod'
import type {
  AppSettings,
  ConflictInfo,
  GraphData,
  McpLaunch,
  HistoryEntry,
  IndexStatus,
  PageFile,
  PageMeta,
  SearchHit,
  PageSummary,
  PropKey,
  TableRow,
  TaskRow,
  FolderLayout,
  TagCount,
  UpdateStatus,
  TemplateInfo,
  TrashEntry,
  TreeNode,
  VaultNotice,
  VaultState,
  WriteResult
} from './types'
import type { CommandId } from './keymap'

const relPath = z
  .string()
  .min(1)
  .max(1024)
  .refine((p) => !p.startsWith('/') && !p.split('/').includes('..'), 'invalid path')
const optRelPath = z.union([relPath, z.literal('')])
const title = z.string().min(1).max(200)
const propValue = z.union([
  z.string().max(10_000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(1000)).max(500),
  z.null()
])
const tableConfig = z.object({
  columns: z.array(z.string().max(100)).max(200).optional(),
  types: z
    .record(z.string().max(100), z.enum(['text', 'number', 'date', 'checkbox', 'link', 'list']))
    .optional(),
  sort: z
    .array(z.object({ key: z.string().max(100), dir: z.enum(['asc', 'desc']) }))
    .max(10)
    .optional(),
  filter: z
    .array(
      z.object({
        key: z.string().max(100),
        op: z.enum(['is', 'isNot', 'contains', 'empty', 'notEmpty', 'before', 'after']),
        value: z.string().max(1000).optional()
      })
    )
    .max(20)
    .optional()
})

/** Argument schemas for every invoke channel. Main validates each call against these. */
export const ipcSchemas = {
  'vault:state': z.tuple([]),
  'vault:create': z.tuple([]),
  'vault:openDialog': z.tuple([]),
  'vault:switch': z.tuple([z.string().min(1)]),
  'vault:forget': z.tuple([z.string().min(1)]),
  'vault:unforget': z.tuple([z.string().min(1)]),
  'vault:notices': z.tuple([]),
  'vault:favorites': z.tuple([]),
  'vault:setFavorite': z.tuple([relPath, z.boolean()]),

  'tree:get': z.tuple([]),
  'page:read': z.tuple([relPath]),
  'page:write': z.tuple([relPath, z.string().max(50_000_000), z.string().nullable()]),
  'page:create': z.tuple([optRelPath, title, z.string().max(50_000_000).optional()]),
  'folder:create': z.tuple([optRelPath, title]),
  'folder:rename': z.tuple([relPath, title]),
  'page:rename': z.tuple([relPath, title]),
  'page:move': z.tuple([relPath, optRelPath]),
  'page:trash': z.tuple([relPath]),
  'folder:trash': z.tuple([relPath]),
  'page:reveal': z.tuple([relPath]),
  'page:openLink': z.tuple([z.string().url()]),
  'page:linkMentions': z.tuple([relPath, title]),
  'page:resolveEmbed': z.tuple([relPath, z.string().min(1).max(500)]),
  'page:share': z.tuple([
    z.object({
      format: z.enum(['md', 'html', 'pdf']),
      title: z.string().max(500),
      content: z.string().max(50_000_000)
    })
  ]),
  'page:export': z.tuple([
    z.object({
      format: z.enum(['pdf', 'html', 'print']),
      title: z.string().max(300),
      html: z.string().max(100_000_000)
    })
  ]),
  'folder:move': z.tuple([relPath, optRelPath]),
  'tree:setOrder': z.tuple([optRelPath, z.array(z.string().min(1).max(300)).max(10_000)]),
  'page:setProps': z.tuple([relPath, z.record(z.string().min(1).max(100), propValue)]),
  'page:updateTask': z.tuple([
    relPath,
    z.number().int().min(0).max(10_000_000),
    z.string().max(10_000),
    z.object({
      done: z.boolean().optional(),
      due: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      text: z.string().min(1).max(10_000).optional()
    })
  ]),
  'folder:layout': z.tuple([optRelPath]),
  'folder:setLayout': z.tuple([
    optRelPath,
    z.object({ mode: z.enum(['cards', 'table']), table: tableConfig }).nullable()
  ]),
  'window:open': z.tuple([relPath.optional()]),
  'asset:save': z.tuple([relPath, z.string().min(1).max(255), z.instanceof(Uint8Array)]),

  'index:titles': z.tuple([]),
  'index:search': z.tuple([z.string().max(500), z.string().max(200).nullable()]),
  'index:backlinks': z.tuple([relPath]),
  'index:mentions': z.tuple([relPath]),
  'index:tags': z.tuple([]),
  'index:graph': z.tuple([]),
  'index:summaries': z.tuple([z.array(relPath).max(5000)]),
  'index:table': z.tuple([optRelPath]),
  'index:propKeys': z.tuple([optRelPath.nullable()]),
  'index:tasks': z.tuple([]),
  'index:resolve': z.tuple([z.string().min(1).max(300)]),
  'index:rebuild': z.tuple([]),
  'index:status': z.tuple([]),

  'history:list': z.tuple([relPath]),
  'history:read': z.tuple([relPath, z.string().regex(/^[0-9a-f]{40}$/)]),
  'history:restore': z.tuple([relPath, z.string().regex(/^[0-9a-f]{40}$/)]),

  'trash:list': z.tuple([]),
  'trash:restore': z.tuple([z.string().min(1)]),
  'trash:delete': z.tuple([z.string().min(1)]),
  'trash:empty': z.tuple([]),

  'conflicts:list': z.tuple([]),
  'conflicts:read': z.tuple([relPath]),
  'conflicts:resolve': z.tuple([relPath, z.enum(['keepMine', 'takeTheirs', 'keepBoth'])]),

  'journal:today': z.tuple([]),
  'journal:day': z.tuple([z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  'capture:append': z.tuple([z.string().min(1).max(100_000)]),
  'capture:hide': z.tuple([]),

  'templates:list': z.tuple([]),
  'templates:render': z.tuple([relPath, z.string().max(200)]),

  'settings:get': z.tuple([]),
  'settings:set': z.tuple([
    z
      .object({
        trashRetentionDays: z.number().int().min(0).max(3650),
        snapshotDelayMs: z.number().int().min(1000).max(600_000),
        captureShortcut: z.string().min(3).max(60),
        historyRetentionDays: z.number().int().min(0).max(36500),
        editorFont: z.enum(['sans', 'serif', 'mono']),
        editorFontSize: z.number().int().min(12).max(26),
        editorWidth: z.enum(['narrow', 'normal', 'wide', 'full']),
        language: z.enum(['system', 'de', 'en']),
        theme: z.enum(['system', 'light', 'dark']),
        autoUpdates: z.enum(['ask', 'on', 'off']),
        mcpAccess: z.enum(['off', 'read', 'write'])
      })
      .partial()
  ]),
  'app:paths': z.tuple([]),
  'mcp:launch': z.tuple([]),
  'tag:rename': z.tuple([z.string().min(1).max(200), z.string().min(1).max(200)]),
  'clipboard:write': z.tuple([z.string().max(50_000_000)]),
  'app:whatsNew': z.tuple([]),
  'app:licenses': z.tuple([]),
  'update:status': z.tuple([]),
  'update:check': z.tuple([]),
  'update:install': z.tuple([]),
  'update:shouldAsk': z.tuple([]),
  'app:revealPath': z.tuple([z.enum(['vault', 'data'])]),
  'app:accentColor': z.tuple([]),
  'app:language': z.tuple([]),
  /** Renderer reports that a requested flush (before close/quit) is done. */
  'app:flushed': z.tuple([z.number().int()])
} as const

export type IpcChannel = keyof typeof ipcSchemas
export type IpcArgs<C extends IpcChannel> = z.infer<(typeof ipcSchemas)[C]>

export interface IpcResults {
  'vault:state': VaultState
  'vault:create': VaultState
  'vault:openDialog': VaultState
  'vault:switch': VaultState
  'vault:forget': VaultState
  'vault:unforget': VaultState
  'vault:notices': VaultNotice[]
  'vault:favorites': string[]
  'vault:setFavorite': string[]

  'tree:get': TreeNode[]
  'page:read': PageFile
  'page:write': WriteResult
  'page:create': string
  'folder:create': string
  'folder:rename': string
  'page:rename': string
  'page:move': string
  'page:trash': string
  'folder:trash': string
  'page:reveal': void
  'page:openLink': void
  'page:linkMentions': { count: number; before: string; hash: string }
  'page:resolveEmbed': string | null
  'page:export': string | null
  'page:share': string
  'folder:move': string
  'tree:setOrder': void
  'page:setProps': void
  'page:updateTask': void
  'folder:layout': FolderLayout | null
  'folder:setLayout': void
  'window:open': void
  'asset:save': string

  'index:titles': PageMeta[]
  'index:search': SearchHit[]
  'index:backlinks': SearchHit[]
  'index:mentions': SearchHit[]
  'index:tags': TagCount[]
  'index:graph': GraphData
  'index:summaries': PageSummary[]
  'index:table': TableRow[]
  'index:propKeys': PropKey[]
  'index:tasks': TaskRow[]
  'index:resolve': string | null
  'index:rebuild': void
  'index:status': IndexStatus

  'history:list': HistoryEntry[]
  'history:read': string
  'history:restore': void

  'trash:list': TrashEntry[]
  'trash:restore': { path: string; kind: 'page' | 'folder' }
  'trash:delete': void
  'trash:empty': void

  'conflicts:list': ConflictInfo[]
  'conflicts:read': { mine: string; theirs: string }
  'conflicts:resolve': void

  'journal:today': string
  'journal:day': string
  'capture:append': void
  'capture:hide': void

  'templates:list': TemplateInfo[]
  'templates:render': string

  'settings:get': AppSettings
  'settings:set': AppSettings
  'app:paths': { vault: string | null; data: string | null; version: string }
  'mcp:launch': McpLaunch
  'tag:rename': number
  'clipboard:write': void
  /** Current version, and the one used last time if the app was updated since (else null). */
  'app:whatsNew': { version: string; since: string | null }
  /** Notices of the bundled open-source libraries (null in development builds). */
  'app:licenses': string | null
  'update:status': UpdateStatus
  'update:check': UpdateStatus
  'update:install': void
  /** Time to ask for permission to check automatically (second launch, not decided yet). */
  'update:shouldAsk': boolean
  'app:revealPath': void
  'app:accentColor': string | null
  'app:language': 'de' | 'en'
  'app:flushed': void
}

/** Events pushed from main to renderer. */
export interface IpcEvents {
  'vault:changed': [VaultState]
  'tree:changed': []
  'update:status': [UpdateStatus]
  /** A page changed on disk through something other than this window's own save. */
  'page:changed': [path: string]
  /** A page was renamed or moved: old path → new path (also for descendants). */
  'page:moved': [moves: { from: string; to: string }[]]
  'index:status': [IndexStatus]
  'index:updated': []
  'conflicts:changed': [ConflictInfo[]]
  'menu:command': [CommandId]
  'app:accentColor': [string | null]
  'capture:shown': []
  'templates:changed': []
  /** Main asks the window to save pending edits (before closing or quitting). */
  'app:flush': [id: number]
  'settings:changed': [AppSettings]
}

export type IpcEvent = keyof IpcEvents

export interface WriteApi {
  invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcResults[C]>
  on<E extends IpcEvent>(event: E, listener: (...args: IpcEvents[E]) => void): () => void
  platform: string
}
