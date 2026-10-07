// MCP server for AI assistants (Claude, OpenCode, …). Started by the assistant over stdio with
// the Write binary in Node mode:  ELECTRON_RUN_AS_NODE=1 Write <app>/out/main/mcp.js
//
// It works on the vault that is open in Write, with the app's own vault code (frontmatter, link
// updates on rename, trash) and records every change in the version history, so anything an
// assistant does can be undone. Access is off until it is allowed in Write's settings.
import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import type { AppSettings, TreeNode, VaultInfo } from '@shared/types'
import { composePage, readHeader } from '@shared/page'
import { localeOf, resolveLanguage } from '@shared/i18n'
import { tagsField } from '@shared/frontmatter'
import { JOURNAL_DIR, join } from '@shared/paths'
import { SNIPPET_CLOSE, SNIPPET_OPEN } from '../indexer/db'
import { Vault } from '../main/vault'
import { LocalIndex } from './localIndex'

const userData =
  process.env.WRITE_USER_DATA ??
  process.env.DOCU_USER_DATA ??
  path.join(os.homedir(), 'Library', 'Application Support', 'Write')

interface SettingsFile {
  vaults?: VaultInfo[]
  lastVaultId?: string | null
  settings?: Partial<AppSettings>
}

/** A problem to report to the assistant as a tool error, in plain words. */
class ToolError extends Error {}

function readSettings(): SettingsFile {
  try {
    return JSON.parse(readFileSync(path.join(userData, 'settings.json'), 'utf8')) as SettingsFile
  } catch {
    return {}
  }
}

let current: { id: string; vault: Vault; index: LocalIndex } | null = null

/** The vault open in Write, if the settings allow this kind of access. Re-read on every call. */
async function vault(write: boolean): Promise<{ vault: Vault; index: LocalIndex }> {
  const s = readSettings()
  const access = s.settings?.mcpAccess ?? 'off'
  if (access === 'off')
    throw new ToolError(
      'Write does not allow access for AI assistants. It can be turned on in Write → Settings → AI assistants.'
    )
  if (write && access !== 'write')
    throw new ToolError(
      'Write only allows reading. Changes can be allowed in Write → Settings → AI assistants.'
    )
  const info = s.vaults?.find((v) => v.id === s.lastVaultId)
  if (!info) throw new ToolError('No vault is open in Write.')
  if (current?.id !== info.id) {
    await current?.vault.close()
    current?.index.close()
    const index = new LocalIndex()
    const language = resolveLanguage(
      s.settings?.language,
      Intl.DateTimeFormat().resolvedOptions().locale
    )
    const v = new Vault(info, {
      dataDir: path.join(userData, 'vaults', info.id),
      index,
      emit: () => undefined,
      snapshotDelayMs: () => 60_000,
      trashRetentionDays: () => s.settings?.trashRetentionDays ?? 30,
      locale: () => localeOf(language),
      watch: false
    })
    await v.open()
    current = { id: info.id, vault: v, index }
  }
  await current.index.refresh()
  return current
}

/** Runs a change and records it in the version history (the state before and after). */
async function change<T>(v: Vault, before: string[], run: () => Promise<T>): Promise<T> {
  if (before.length) await v.history.snapshot(before, 'Vor Änderung durch KI-Assistent')
  const result = await run()
  await v.history.flush()
  return result
}

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] })
const json = (value: unknown) => text(JSON.stringify(value, null, 2))
const highlight = (s: string): string =>
  s.split(SNIPPET_OPEN).join('**').split(SNIPPET_CLOSE).join('**')

function tool<A>(fn: (args: A) => Promise<ReturnType<typeof text>>) {
  return async (args: A) => {
    try {
      return await fn(args)
    } catch (err) {
      const message =
        err instanceof ToolError
          ? err.message
          : `Write could not do that: ${err instanceof Error ? err.message : String(err)}`
      return { ...text(message), isError: true }
    }
  }
}

function flatten(nodes: TreeNode[], out: { path: string; title: string }[] = []) {
  for (const n of nodes) {
    if (n.path) out.push({ path: n.path, title: n.name })
    if (n.children) flatten(n.children, out)
  }
  return out
}

async function readPage(v: Vault, rel: string) {
  const page = await v.read(rel)
  const header = readHeader(rel, page.text)
  return { page, header }
}

const server = new McpServer(
  { name: 'write', title: 'Write', version: '1.0.0' },
  {
    instructions:
      'Write is a Markdown notes app. Pages are Markdown files in a vault; paths are relative to the vault (e.g. "Projekte/Plan.md"). ' +
      'Pages link with [[Title]] wiki links and carry tags (#tag or in the frontmatter). The title, id and dates live in the frontmatter, which Write manages – ' +
      'page contents you read and write here are the Markdown body only. Every change is kept in Write’s version history and can be undone there.'
  }
)

const readOnly = { readOnlyHint: true, openWorldHint: false }
const writes = { readOnlyHint: false, destructiveHint: false, openWorldHint: false }

// ── Reading ──────────────────────────────────────────────────────────────────

server.registerTool(
  'search_pages',
  {
    title: 'Search pages',
    description:
      'Full-text search over all pages (titles weigh more). Words match as prefixes. Optionally only pages with a tag.',
    inputSchema: {
      query: z.string().describe('Words to search for; may be empty when a tag is given'),
      tag: z.string().optional().describe('Only pages with this tag, without #'),
      limit: z.number().int().min(1).max(100).optional()
    },
    annotations: readOnly
  },
  tool(async ({ query, tag, limit }) => {
    const { index } = await vault(false)
    const hits = index.db.search(query, tag?.replace(/^#/, '').toLowerCase() ?? null, limit ?? 20)
    if (!hits.length) return text('No pages found.')
    return json(hits.map((h) => ({ path: h.path, title: h.title, snippet: highlight(h.snippet) })))
  })
)

server.registerTool(
  'read_page',
  {
    title: 'Read a page',
    description:
      'Returns a page’s title, tags and Markdown body. `hash` identifies this version; pass it to update_page to avoid overwriting newer edits.',
    inputSchema: { path: z.string().describe('Vault-relative path, e.g. "Projekte/Plan.md"') },
    annotations: readOnly
  },
  tool(async ({ path: rel }) => {
    const { vault: v } = await vault(false)
    const { page, header } = await readPage(v, rel)
    return text(
      [
        `path: ${rel}`,
        `title: ${header.title}`,
        `tags: ${tagsField(header.data).join(', ') || '–'}`,
        `hash: ${page.hash}`,
        '',
        header.body.replace(/^\n+/, '')
      ].join('\n')
    )
  })
)

server.registerTool(
  'list_pages',
  {
    title: 'List pages',
    description: 'All pages of the vault with path and title, optionally only inside a folder.',
    inputSchema: {
      folder: z.string().optional().describe('Only pages below this folder, e.g. "Projekte"')
    },
    annotations: readOnly
  },
  tool(async ({ folder }) => {
    const { vault: v } = await vault(false)
    const prefix = folder ? folder.replace(/\/+$/, '') + '/' : ''
    const pages = flatten(await v.tree()).filter((p) => p.path.startsWith(prefix))
    return json(pages)
  })
)

server.registerTool(
  'get_backlinks',
  {
    title: 'Pages linking here',
    description: 'Pages that link to the given page with a wiki link.',
    inputSchema: { path: z.string() },
    annotations: readOnly
  },
  tool(async ({ path: rel }) => {
    const { index } = await vault(false)
    const hits = index.db.backlinks(rel)
    if (!hits.length) return text('No pages link here.')
    return json(hits.map((h) => ({ path: h.path, title: h.title })))
  })
)

server.registerTool(
  'list_tags',
  {
    title: 'List tags',
    description: 'All tags with the number of pages using them.',
    inputSchema: {},
    annotations: readOnly
  },
  tool(async () => {
    const { index } = await vault(false)
    return json(index.db.tags())
  })
)

server.registerTool(
  'resolve_link',
  {
    title: 'Find a page by title',
    description: 'Resolves a wiki-link target (title, file name or "Folder/Title") to a page path.',
    inputSchema: { title: z.string() },
    annotations: readOnly
  },
  tool(async ({ title }) => {
    const { index } = await vault(false)
    const rel = index.db.resolve(title)
    return text(rel ?? 'No page with that title.')
  })
)

server.registerTool(
  'read_journal',
  {
    title: 'Read a journal day',
    description: 'The journal page of a day (default today), if there is one.',
    inputSchema: {
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('YYYY-MM-DD')
    },
    annotations: readOnly
  },
  tool(async ({ date }) => {
    const { vault: v } = await vault(false)
    const day = date ?? new Date().toLocaleDateString('sv-SE')
    try {
      const { header } = await readPage(v, join(JOURNAL_DIR, `${day}.md`))
      return text(header.body.replace(/^\n+/, '') || '(empty)')
    } catch {
      return text(`No journal entry for ${day}.`)
    }
  })
)

// ── Writing ──────────────────────────────────────────────────────────────────

server.registerTool(
  'create_page',
  {
    title: 'Create a page',
    description:
      'Creates a new page with a title and Markdown body. With `parent`, the page goes into that folder or below that page.',
    inputSchema: {
      title: z.string().min(1),
      content: z.string().describe('Markdown body, without frontmatter'),
      parent: z
        .string()
        .optional()
        .describe(
          'Folder ("Projekte") or page ("Projekte.md") to create it in; default the vault root'
        )
    },
    annotations: writes
  },
  tool(async ({ title, content, parent }) => {
    const { vault: v } = await vault(true)
    const rel = await change(v, [], () =>
      v.create(parent ?? '', title, content ? `\n${content.replace(/^\n+/, '')}` : '')
    )
    return text(`Created ${rel}`)
  })
)

server.registerTool(
  'update_page',
  {
    title: 'Replace a page’s content',
    description:
      'Replaces the Markdown body of a page; title and tags in the frontmatter stay. Pass `hash` from read_page so edits made in the meantime are not overwritten.',
    inputSchema: {
      path: z.string(),
      content: z.string().describe('The complete new Markdown body'),
      hash: z.string().optional()
    },
    annotations: { ...writes, destructiveHint: true }
  },
  tool(async ({ path: rel, content, hash }) => {
    const { vault: v } = await vault(true)
    const { page, header } = await readPage(v, rel)
    if (hash && hash !== page.hash)
      throw new ToolError('The page changed since it was read. Read it again and retry.')
    const lead = /^\n*/.exec(header.body)![0] || '\n'
    const res = await change(v, [rel], () =>
      v.write(rel, composePage(header, rel, lead + content.replace(/^\n+/, '')), page.hash)
    )
    if (!res.ok) throw new ToolError('The page changed while writing. Read it again and retry.')
    return text(`Updated ${rel}`)
  })
)

server.registerTool(
  'append_to_page',
  {
    title: 'Append to a page',
    description: 'Adds Markdown at the end of a page.',
    inputSchema: { path: z.string(), content: z.string() },
    annotations: writes
  },
  tool(async ({ path: rel, content }) => {
    const { vault: v } = await vault(true)
    const { page, header } = await readPage(v, rel)
    const body = header.body.replace(/\s+$/, '')
    const next = (body ? body + '\n\n' : '\n') + content.trim() + '\n'
    const res = await change(v, [rel], () =>
      v.write(rel, composePage(header, rel, next), page.hash)
    )
    if (!res.ok) throw new ToolError('The page changed while writing. Please retry.')
    return text(`Appended to ${rel}`)
  })
)

server.registerTool(
  'add_to_journal',
  {
    title: 'Add to today’s journal',
    description: 'Adds a timestamped entry to today’s journal page, like Write’s Quick Capture.',
    inputSchema: { content: z.string().min(1) },
    annotations: writes
  },
  tool(async ({ content }) => {
    const { vault: v } = await vault(true)
    const today = join(JOURNAL_DIR, `${new Date().toLocaleDateString('sv-SE')}.md`)
    const rel = await change(v, [today], () => v.captureAppend(content))
    return text(`Added to ${rel}`)
  })
)

server.registerTool(
  'rename_page',
  {
    title: 'Rename a page',
    description: 'Gives a page a new title; wiki links to it in other pages are updated.',
    inputSchema: { path: z.string(), new_title: z.string().min(1) },
    annotations: writes
  },
  tool(async ({ path: rel, new_title }) => {
    const { vault: v } = await vault(true)
    const next = await change(v, [rel], () => v.rename(rel, new_title))
    return text(`Renamed to ${next}`)
  })
)

server.registerTool(
  'move_page',
  {
    title: 'Move a page',
    description:
      'Moves a page (with its subpages) into a folder, below another page, or to the root ("").',
    inputSchema: { path: z.string(), new_parent: z.string() },
    annotations: writes
  },
  tool(async ({ path: rel, new_parent }) => {
    const { vault: v } = await vault(true)
    const next = await change(v, [rel], () => v.move(rel, new_parent))
    return text(`Moved to ${next}`)
  })
)

server.registerTool(
  'trash_page',
  {
    title: 'Move a page to the trash',
    description: 'Moves a page to Write’s trash, where it can be restored.',
    inputSchema: { path: z.string() },
    annotations: { ...writes, destructiveHint: true }
  },
  tool(async ({ path: rel }) => {
    const { vault: v } = await vault(true)
    await change(v, [rel], () => v.trashPage(rel))
    return text(`Moved ${rel} to the trash`)
  })
)

await server.connect(new StdioServerTransport())

const shutdown = async (): Promise<void> => {
  await current?.vault.close()
  current?.index.close()
  process.exit(0)
}
process.stdin.on('close', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
