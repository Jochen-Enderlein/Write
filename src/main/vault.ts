import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { ulid } from 'ulid'
import type { IpcEvents } from '@shared/ipc'
import type {
  ConflictInfo,
  PageFile,
  TemplateInfo,
  TreeNode,
  VaultInfo,
  VaultNotice,
  WriteResult
} from '@shared/types'
import {
  ASSETS_DIR,
  CONFIG_DIR,
  JOURNAL_DIR,
  TRASH_DIR,
  assetUrlFor,
  basename,
  childFolderOf,
  dirname,
  isHiddenName,
  isMarkdown,
  isWithin,
  join,
  sanitizeTitle,
  stemOf
} from '@shared/paths'
import { icloudTarget, isConflictCopy, originalOfConflict } from '@shared/conflicts'
import { buildFrontmatter, splitFrontmatter, updateFrontmatter } from '@shared/frontmatter'
import { dayKey, isoLocal, timeKey } from '@shared/dates'
import { newPageFrontmatter, readHeader } from '@shared/page'
import { renameTagInText } from '@shared/tags'
import {
  IMAGE_EXT_RE,
  mapOutsideCode,
  parseLinkTarget,
  rewriteAssetPrefix,
  rewriteWikilinks
} from '@shared/wikilinks'
import {
  atomicWrite,
  exists,
  freeName,
  hashText,
  isEmptyDir,
  readJson,
  resolveInside,
  toRel,
  writeJson
} from './fsutil'
import { History } from './history'
import { Trash } from './trash'
import { VaultWatcher, type WatchBatch } from './watcher'
import { withTx } from './tx'

const run = promisify(execFile)

const GONE = 'gone'

export type Emit = <E extends keyof IpcEvents>(event: E, ...args: IpcEvents[E]) => void

interface VaultConfig {
  id: string
  name: string
  created: string
  favorites: string[]
  /** Manual order per folder ('' = root): entry names (`Seite.md`, `Ordner`). Synced with the vault. */
  order?: Record<string, string[]>
}

/** What a vault needs from the search index (the app's index process, or the MCP server's). */
export interface VaultIndex {
  open(root: string, dbFile: string): void
  sync(): void
  changed(paths: string[]): void
  deleted(paths: string[]): void
  linkSources(titles: string[]): Promise<string[]>
}

interface VaultOptions {
  dataDir: string
  index: VaultIndex
  emit: Emit
  snapshotDelayMs: () => number
  trashRetentionDays: () => number
  historyRetentionDays?: () => number
  /** Locale for dates written into pages and templates. */
  locale?: () => string
  /**
   * False for a second process working on the same vault (the MCP server): no file watcher, no
   * trash or history cleanup – the app does that.
   */
  watch?: boolean
}

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })

/** Reads or creates `.docuapp/vault.json`; new vaults also get starter templates. */
export async function ensureVaultConfig(root: string, fallbackName: string): Promise<VaultConfig> {
  const file = path.join(root, CONFIG_DIR, 'vault.json')
  const existing = await readJson<Partial<VaultConfig> | null>(file, null)
  if (existing?.id)
    return { name: fallbackName, created: isoLocal(), favorites: [], ...existing } as VaultConfig
  const cfg: VaultConfig = { id: ulid(), name: fallbackName, created: isoLocal(), favorites: [] }
  await writeJson(file, cfg)
  await writeStarterTemplates(root)
  return cfg
}

async function writeStarterTemplates(root: string): Promise<void> {
  const dir = path.join(root, CONFIG_DIR, 'templates')
  await fs.mkdir(dir, { recursive: true })
  const templates: Record<string, string> = {
    'Besprechung.md':
      '# {{title}}\n\n**Datum:** {{date}} · {{time}}\n\n## Teilnehmende\n\n- \n\n## Themen\n\n1. \n\n## Entscheidungen\n\n> [!note] Ergebnis\n> \n\n## Aufgaben\n\n- [ ] \n',
    'Projekt.md':
      '# {{title}}\n\n> [!info] Ziel\n> Worum geht es in einem Satz?\n\n## Status\n\n- [ ] Planung\n- [ ] Umsetzung\n- [ ] Abschluss\n\n## Notizen\n\n## Links\n\n'
  }
  for (const [name, body] of Object.entries(templates)) {
    const f = path.join(dir, name)
    if (!(await exists(f))) await fs.writeFile(f, body)
  }
}

/** One open vault: file operations, watcher, trash, snapshots. All paths are vault-relative. */
export class Vault {
  readonly root: string
  readonly trash: Trash
  readonly history: History
  private watcher: VaultWatcher
  private config!: VaultConfig
  /** Hash of the content we last wrote per path, to tell our own writes from external ones. */
  private ownWrites = new Map<string, string>()
  private conflicts: ConflictInfo[] = []
  private notices: VaultNotice[] = []
  private downloading = new Set<string>()
  private purgeTimer: NodeJS.Timeout | undefined

  constructor(
    readonly info: VaultInfo,
    private readonly opts: VaultOptions
  ) {
    this.root = info.path
    this.trash = new Trash(this.root)
    this.history = new History(this.root, path.join(opts.dataDir, 'git'), opts.snapshotDelayMs)
    this.watcher = new VaultWatcher(this.root, (b) => void this.onWatch(b))
  }

  async open(): Promise<void> {
    await fs.mkdir(this.opts.dataDir, { recursive: true })
    this.config = await ensureVaultConfig(this.root, this.info.name)
    this.opts.index.open(this.root, path.join(this.opts.dataDir, 'index.sqlite'))
    if (this.opts.watch === false) return
    this.watcher.start()
    const purge = (): void => {
      void this.trash.purge(this.opts.trashRetentionDays()).catch(() => undefined)
      const days = this.opts.historyRetentionDays?.() ?? 0
      if (days > 0) void this.history.prune(days).catch(() => undefined)
    }
    purge()
    this.purgeTimer = setInterval(purge, 6 * 60 * 60 * 1000)
    void this.checkNotLocal()
  }

  async close(): Promise<void> {
    this.watcher.stop()
    clearInterval(this.purgeTimer)
    await this.history.flush()
  }

  abs(rel: string): string {
    return resolveInside(this.root, rel)
  }

  // ── Tree ──────────────────────────────────────────────────────────────────

  async tree(): Promise<TreeNode[]> {
    const conflicts: ConflictInfo[] = []
    const walk = async (dirRel: string): Promise<TreeNode[]> => {
      let entries
      try {
        entries = await fs.readdir(dirRel ? this.abs(dirRel) : this.root, { withFileTypes: true })
      } catch {
        return []
      }
      const names = new Set(entries.map((e) => e.name))
      const pages: TreeNode[] = []
      const folders: Promise<TreeNode | null>[] = []
      for (const e of entries) {
        const rel = join(dirRel, e.name)
        const target = icloudTarget(rel)
        if (target && isMarkdown(target) && !names.has(basename(target))) {
          // Evicted iCloud file: show it and fetch it in the background
          pages.push({
            id: target,
            name: stemOf(target),
            kind: 'page',
            path: target,
            folder: childFolderOf(target),
            placeholder: true
          })
          this.download(rel, target)
          continue
        }
        if (isHiddenName(e.name)) continue
        if (e.isFile() && isMarkdown(e.name)) {
          if (isConflictCopy(rel)) {
            conflicts.push({ conflictPath: rel, originalPath: originalOfConflict(rel) })
            continue
          }
          pages.push({
            id: rel,
            name: stemOf(rel),
            kind: 'page',
            path: rel,
            folder: childFolderOf(rel)
          })
        } else if (e.isDirectory()) {
          if (names.has(e.name + '.md')) continue // children of a page, handled below
          folders.push(
            walk(rel).then((children) => ({
              id: rel,
              name: e.name,
              kind: 'folder' as const,
              path: null,
              folder: rel,
              children
            }))
          )
        }
      }
      await Promise.all(
        pages.map(async (p) => {
          if (names.has(p.name)) {
            const children = await walk(p.folder)
            if (children.length) p.children = children
          }
        })
      )
      const nodes = [...pages, ...((await Promise.all(folders)).filter(Boolean) as TreeNode[])]
      const desc = dirRel === JOURNAL_DIR
      nodes.sort((a, b) => (desc ? -1 : 1) * collator.compare(a.name, b.name))
      return this.applyOrder(dirRel, nodes)
    }
    const nodes = await walk('')
    this.setConflicts(conflicts)
    return nodes
  }

  private setConflicts(list: ConflictInfo[]): void {
    const key = (l: ConflictInfo[]): string =>
      l
        .map((c) => c.conflictPath)
        .sort()
        .join('\n')
    if (key(list) !== key(this.conflicts)) {
      this.conflicts = list
      this.opts.emit('conflicts:changed', list)
    }
  }

  getConflicts(): ConflictInfo[] {
    return this.conflicts
  }

  private download(placeholderRel: string, target: string): void {
    if (this.downloading.has(target)) return
    this.downloading.add(target)
    run('/usr/bin/brctl', ['download', this.abs(target)])
      .catch((err) =>
        console.warn('[icloud] brctl download fehlgeschlagen', placeholderRel, err.message)
      )
      .finally(() => setTimeout(() => this.downloading.delete(target), 30_000))
  }

  /** Warns when files of a File Provider vault (e.g. Nextcloud) are not kept locally. */
  private async checkNotLocal(): Promise<void> {
    if (process.platform !== 'darwin') return
    try {
      const sample: string[] = []
      const walk = async (dir: string, depth: number): Promise<void> => {
        if (sample.length >= 40 || depth > 3) return
        for (const e of await fs.readdir(dir, { withFileTypes: true })) {
          if (e.name.startsWith('.')) continue
          const p = path.join(dir, e.name)
          if (e.isFile() && isMarkdown(e.name)) sample.push(p)
          else if (e.isDirectory()) await walk(p, depth + 1)
          if (sample.length >= 40) return
        }
      }
      await walk(this.root, 0)
      if (!sample.length) return
      const { stdout } = await run('/usr/bin/stat', ['-f', '%Xf', ...sample])
      const SF_DATALESS = 0x40000000
      const dataless = stdout
        .split('\n')
        .filter((l) => l && (parseInt(l, 16) & SF_DATALESS) !== 0).length
      if (dataless > 0) {
        this.notices = [{ kind: 'notLocal', message: 'notice.notLocal' }]
      }
    } catch {
      // stat flags are best-effort only
    }
  }

  getNotices(): VaultNotice[] {
    return this.notices
  }

  // ── Pages ─────────────────────────────────────────────────────────────────

  async read(rel: string): Promise<PageFile> {
    const abs = this.abs(rel)
    const [text, st] = await Promise.all([fs.readFile(abs, 'utf8'), fs.stat(abs)])
    return { path: rel, text, hash: hashText(text), mtimeMs: st.mtimeMs }
  }

  /**
   * Writes a page. With `baseHash`, refuses to overwrite a file that changed on disk since the
   * caller loaded it (e.g. a sync from another Mac) and reports a conflict instead.
   */
  async write(rel: string, text: string, baseHash: string | null): Promise<WriteResult> {
    if (!isMarkdown(rel)) throw new Error('Nur Markdown-Seiten können gespeichert werden')
    const abs = this.abs(rel)
    if (baseHash !== null) {
      let disk: string | null
      try {
        disk = await fs.readFile(abs, 'utf8')
      } catch {
        disk = null
      }
      if (disk !== null) {
        const diskHash = hashText(disk)
        if (diskHash !== baseHash && diskHash !== hashText(text))
          return { ok: false, reason: 'conflict', diskText: disk, diskHash }
      }
    }
    return { ok: true, hash: await this.writeOwn(rel, text) }
  }

  private async writeOwn(rel: string, text: string): Promise<string> {
    const hash = hashText(text)
    this.ownWrites.set(rel, hash)
    await atomicWrite(this.abs(rel), text)
    this.opts.index.changed([rel])
    this.history.schedule(rel)
    return hash
  }

  private folderFor(parentRel: string): string {
    if (parentRel === '') return ''
    return isMarkdown(parentRel) ? childFolderOf(parentRel) : parentRel
  }

  async create(parentRel: string, title: string, body = ''): Promise<string> {
    const dirRel = this.folderFor(parentRel)
    const dirAbs = dirRel ? this.abs(dirRel) : this.root
    await fs.mkdir(dirAbs, { recursive: true })
    const stem = await freeName(dirAbs, sanitizeTitle(title), '.md')
    const rel = join(dirRel, stem + '.md')
    await this.writeOwn(
      rel,
      newPageFrontmatter(stem === sanitizeTitle(title) ? title : stem) + body
    )
    await this.hush([rel])
    this.opts.emit('tree:changed')
    return rel
  }

  /** Creates a plain folder (no page of its own) at the root, inside a folder, or below a page. */
  async createFolder(parentRel: string, name: string): Promise<string> {
    const dirRel = this.folderFor(parentRel)
    const dirAbs = dirRel ? this.abs(dirRel) : this.root
    await fs.mkdir(dirAbs, { recursive: true })
    // A folder must not collide with a page's child folder (`Name.md` + `Name/`)
    const stem = await freeName(
      dirAbs,
      sanitizeTitle(name),
      '',
      async (s) =>
        !(await exists(path.join(dirAbs, s))) && !(await exists(path.join(dirAbs, s + '.md')))
    )
    const rel = join(dirRel, stem)
    await fs.mkdir(this.abs(rel))
    this.opts.emit('tree:changed')
    return rel
  }

  /** Renames a plain folder; pages inside move along (links use titles, so they stay valid). */
  async renameFolder(rel: string, name: string): Promise<string> {
    if (await exists(this.abs(rel + '.md'))) throw new Error('error.notAFolder')
    const stem = sanitizeTitle(name)
    const next = join(dirname(rel), stem)
    if (next === rel) return rel
    const sameIgnoringCase = next.toLowerCase() === rel.toLowerCase()
    if (
      !sameIgnoringCase &&
      ((await exists(this.abs(next))) || (await exists(this.abs(next + '.md'))))
    )
      throw new Error('error.nameTaken')
    const before = await this.descendants(rel)
    await this.history.flush()
    await fs.rename(this.abs(rel), this.abs(next))
    await this.remapOrder(rel, next)
    const moves = before.map((p) => ({ from: p, to: next + p.slice(rel.length) }))
    await this.afterMove(moves, [])
    void this.history.snapshot(
      [...moves.map((m) => m.from), ...moves.map((m) => m.to)],
      `Ordner umbenannt: ${rel} → ${next}`
    )
    return next
  }

  /** Moves a plain folder with everything inside into another folder, below a page, or to the root. */
  async moveFolder(rel: string, newParentRel: string): Promise<string> {
    if (await exists(this.abs(rel + '.md'))) throw new Error('error.notAFolder')
    const targetDir = this.folderFor(newParentRel)
    if (isWithin(rel, targetDir)) throw new Error('error.moveIntoSelf')
    if (dirname(rel) === targetDir) return rel
    const targetAbs = targetDir ? this.abs(targetDir) : this.root
    await fs.mkdir(targetAbs, { recursive: true })
    const stem = await freeName(
      targetAbs,
      basename(rel),
      '',
      async (s) =>
        !(await exists(path.join(targetAbs, s))) && !(await exists(path.join(targetAbs, s + '.md')))
    )
    const next = join(targetDir, stem)
    const before = await this.descendants(rel)
    await this.history.flush()
    await fs.rename(this.abs(rel), this.abs(next))
    await this.removeIfEmpty(dirname(rel))
    await this.remapOrder(rel, next)
    const moves = before.map((p) => ({ from: p, to: next + p.slice(rel.length) }))
    await this.afterMove(moves, [])
    void this.history.snapshot(
      [...moves.map((m) => m.from), ...moves.map((m) => m.to)],
      `Ordner verschoben: ${rel} → ${next}`
    )
    return next
  }

  // ── Manual order ──────────────────────────────────────────────────────────

  /** Sorts entries listed in the manual order of `dirRel` first, the rest keep their order. */
  private applyOrder(dirRel: string, nodes: TreeNode[]): TreeNode[] {
    const order = this.config?.order?.[dirRel]
    if (!order?.length) return nodes
    const rank = new Map(order.map((n, i) => [n, i]))
    const pos = (n: TreeNode): number => rank.get(basename(n.id)) ?? Number.MAX_SAFE_INTEGER
    return nodes
      .map((n, i) => ({ n, i }))
      .sort((a, b) => pos(a.n) - pos(b.n) || a.i - b.i)
      .map((x) => x.n)
  }

  /** Stores the manual order of one folder's entries (`Seite.md`, `Ordner`). */
  async setOrder(dirRel: string, names: string[]): Promise<void> {
    const order = { ...(this.config.order ?? {}) }
    if (names.length) order[dirRel] = [...new Set(names)]
    else delete order[dirRel]
    this.config.order = order
    await this.saveConfig()
    this.opts.emit('tree:changed')
  }

  /** Keeps the manual order valid after an entry was renamed or moved (`to` = '' when gone). */
  private async remapOrder(from: string, to: string): Promise<void> {
    const order = this.config.order
    if (!order) return
    let changed = false
    const next: Record<string, string[]> = {}
    for (const [dir, names] of Object.entries(order)) {
      // Keys inside a moved folder move along
      const key = to && isWithin(from, dir) && dir !== '' ? to + dir.slice(from.length) : dir
      if (key !== dir) changed = true
      let list = names
      if (dir === dirname(from) && names.includes(basename(from))) {
        changed = true
        list =
          to && dirname(to) === dir
            ? names.map((n) => (n === basename(from) ? basename(to) : n))
            : names.filter((n) => n !== basename(from))
      }
      if (list.length) next[key] = list
    }
    if (!changed) return
    this.config.order = next
    await this.saveConfig()
  }

  /** All markdown paths below a page's child folder (for path remapping). */
  private async descendants(folderRel: string): Promise<string[]> {
    const out: string[] = []
    const walk = async (dirRel: string): Promise<void> => {
      let entries
      try {
        entries = await fs.readdir(this.abs(dirRel), { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        if (e.name.startsWith('.') || e.name === ASSETS_DIR) continue
        const rel = join(dirRel, e.name)
        if (e.isDirectory()) await walk(rel)
        else if (isMarkdown(e.name)) out.push(rel)
      }
    }
    await walk(folderRel)
    return out
  }

  /**
   * Renames a page: file, sub-page folder (with `_assets/`), own title and asset links, and
   * every wiki link pointing to it – as one transaction with a snapshot beforehand.
   */
  async rename(rel: string, newTitle: string): Promise<string> {
    const title = newTitle.trim()
    if (!title) throw new Error('Titel darf nicht leer sein')
    const page = await this.read(rel)
    const header = readHeader(rel, page.text)
    const oldStem = stemOf(rel)
    const newStem = sanitizeTitle(title)
    const newRel = join(dirname(rel), newStem + '.md')
    const sameFile = newRel.toLowerCase() === rel.toLowerCase()
    if (
      !sameFile &&
      ((await exists(this.abs(newRel))) || (await exists(this.abs(childFolderOf(newRel)))))
    ) {
      throw new Error('error.nameTaken')
    }
    const oldFolder = childFolderOf(rel)
    const newFolder = childFolderOf(newRel)
    const hasFolder = await exists(this.abs(oldFolder))
    const before = hasFolder ? await this.descendants(oldFolder) : []
    const sources = (await this.opts.index.linkSources([header.title, oldStem])).filter(
      (s) => s !== rel
    )
    await this.history.flush()
    await this.history.snapshot([rel, ...sources, ...before], 'Vor dem Umbenennen')

    const mapPath = (p: string): string =>
      isWithin(oldFolder, p) ? newFolder + p.slice(oldFolder.length) : p
    const relink = (text: string): string => {
      let t = rewriteWikilinks(text, header.title, title)
      if (oldStem.toLowerCase() !== header.title.toLowerCase())
        t = rewriteWikilinks(t, oldStem, title)
      return t
    }

    await withTx(async (tx) => {
      const fm = header.raw
        ? updateFrontmatter(header.raw, { title, updated: isoLocal() })
        : buildFrontmatter({ id: ulid(), title, created: isoLocal(), updated: isoLocal() })
      const ownText = fm + relink(rewriteAssetPrefix(header.body, oldStem, newStem))
      await tx.write(this.abs(rel), ownText)
      if (!sameFile || newRel !== rel) await tx.rename(this.abs(rel), this.abs(newRel))
      if (hasFolder && oldFolder !== newFolder)
        await tx.rename(this.abs(oldFolder), this.abs(newFolder))
      for (const src of sources) {
        const target = mapPath(src)
        const text = await fs.readFile(this.abs(target), 'utf8')
        const next = relink(text)
        if (next !== text) {
          await tx.write(this.abs(target), next)
          this.ownWrites.set(target, hashText(next))
        }
      }
      this.ownWrites.set(newRel, hashText(ownText))
    })

    await this.remapOrder(rel, newRel)
    if (hasFolder) await this.remapOrder(oldFolder, newFolder)
    const moves = [{ from: rel, to: newRel }, ...before.map((p) => ({ from: p, to: mapPath(p) }))]
    await this.afterMove(moves, sources.map(mapPath))
    void this.history.snapshot(
      [...new Set([rel, newRel, ...sources.map(mapPath), ...before, ...moves.map((m) => m.to)])],
      `Umbenannt: ${header.title} → ${title}`
    )
    return newRel
  }

  /** Moves a page (with sub-pages and assets) below another page, into a folder, or to the root. */
  async move(rel: string, newParentRel: string): Promise<string> {
    const targetDir = this.folderFor(newParentRel)
    const oldFolder = childFolderOf(rel)
    if (isWithin(oldFolder, targetDir)) throw new Error('error.moveIntoSelf')
    if (dirname(rel) === targetDir) return rel
    const targetAbs = targetDir ? this.abs(targetDir) : this.root
    const stem = await freeName(
      targetAbs,
      stemOf(rel),
      '.md',
      async (s) =>
        !(await exists(path.join(targetAbs, s + '.md'))) && !(await exists(path.join(targetAbs, s)))
    )
    const newRel = join(targetDir, stem + '.md')
    const newFolder = childFolderOf(newRel)
    const hasFolder = await exists(this.abs(oldFolder))
    const before = hasFolder ? await this.descendants(oldFolder) : []
    await this.history.flush()

    await withTx(async (tx) => {
      await tx.mkdir(targetAbs)
      await tx.rename(this.abs(rel), this.abs(newRel))
      if (hasFolder) await tx.rename(this.abs(oldFolder), this.abs(newFolder))
      if (stem !== stemOf(rel)) {
        const text = await fs.readFile(this.abs(newRel), 'utf8')
        await tx.write(this.abs(newRel), rewriteAssetPrefix(text, stemOf(rel), stem))
      }
    })
    await this.removeIfEmpty(dirname(rel))
    await this.remapOrder(rel, newRel)
    if (hasFolder) await this.remapOrder(oldFolder, newFolder)
    const moves = [
      { from: rel, to: newRel },
      ...before.map((p) => ({ from: p, to: newFolder + p.slice(oldFolder.length) }))
    ]
    await this.afterMove(moves, [])
    void this.history.snapshot(
      [...moves.map((m) => m.from), ...moves.map((m) => m.to)],
      `Verschoben: ${rel} → ${newRel}`
    )
    return newRel
  }

  /** Cleans up a page's child folder once its last sub-page left. */
  private async removeIfEmpty(dirRel: string): Promise<void> {
    if (!dirRel) return
    const abs = this.abs(dirRel)
    if (!(await exists(this.abs(dirRel + '.md')))) return
    if (await isEmptyDir(abs)) await fs.rm(abs, { recursive: true, force: true })
  }

  private async afterMove(
    moves: { from: string; to: string }[],
    rewritten: string[]
  ): Promise<void> {
    await this.hush([...moves.map((m) => m.from), ...moves.map((m) => m.to), ...rewritten])
    this.opts.index.deleted(moves.map((m) => m.from))
    this.opts.index.changed([...moves.map((m) => m.to), ...rewritten])
    const map = new Map(moves.map((m) => [m.from, m.to]))
    if (this.config.favorites.some((f) => map.has(f))) {
      this.config.favorites = this.config.favorites.map((f) => map.get(f) ?? f)
      await this.saveConfig()
    }
    this.opts.emit('page:moved', moves)
    this.opts.emit('tree:changed')
  }

  /** Moves a plain folder with all pages inside into the trash. Returns the trash entry id. */
  async trashFolder(rel: string): Promise<string> {
    if (await exists(this.abs(rel + '.md'))) throw new Error('error.notAFolder')
    const before = await this.descendants(rel)
    await this.history.flush()
    const id = await this.trash.putFolder(rel)
    await this.forget(before, `Ordner gelöscht: ${rel}`)
    return id
  }

  /** Bookkeeping after paths left the vault: index, favorites, history, renderer. */
  private async forget(gone: string[], message: string): Promise<void> {
    await this.hush(gone)
    this.opts.index.deleted(gone)
    if (this.config.favorites.some((f) => gone.includes(f))) {
      this.config.favorites = this.config.favorites.filter((f) => !gone.includes(f))
      await this.saveConfig()
    }
    if (gone.length) void this.history.snapshot(gone, message)
    this.opts.emit(
      'page:moved',
      gone.map((from) => ({ from, to: '' }))
    )
    this.opts.emit('tree:changed')
  }

  async trashPage(rel: string): Promise<string> {
    const page = await this.read(rel)
    const header = readHeader(rel, page.text)
    const folder = childFolderOf(rel)
    const before = (await exists(this.abs(folder))) ? await this.descendants(folder) : []
    await this.history.flush()
    const id = await this.trash.put(rel, header.title)
    await this.removeIfEmpty(dirname(rel))
    await this.forget([rel, ...before], `Gelöscht: ${header.title}`)
    return id
  }

  async restoreFromTrash(id: string): Promise<{ path: string; kind: 'page' | 'folder' }> {
    const r = await this.trash.restore(id)
    const restored =
      r.kind === 'folder'
        ? await this.descendants(r.path)
        : [r.path, ...(r.folder ? await this.descendants(childFolderOf(r.path)) : [])]
    await this.hush(restored)
    this.opts.index.changed(restored)
    this.opts.emit('tree:changed')
    return { path: r.path, kind: r.kind }
  }

  async saveAsset(pageRel: string, fileName: string, bytes: Uint8Array): Promise<string> {
    const dirRel = join(childFolderOf(pageRel), ASSETS_DIR)
    const dirAbs = this.abs(dirRel)
    await fs.mkdir(dirAbs, { recursive: true })
    const ext = path
      .extname(fileName)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, '')
    const base =
      sanitizeTitle(path.basename(fileName, path.extname(fileName))).replace(/\s+/g, '-') || 'datei'
    const stem = await freeName(dirAbs, base, ext)
    await atomicWrite(path.join(dirAbs, stem + ext), bytes)
    this.opts.emit('tree:changed')
    return assetUrlFor(pageRel, stem + ext)
  }

  /**
   * Records the current state of paths we just touched (content hash, or "gone"), so the watcher
   * ignores exactly these states – any later external change still gets reported.
   */
  private async hush(rels: string[]): Promise<void> {
    await Promise.all(
      rels.map(async (r) => {
        try {
          this.ownWrites.set(r, hashText(await fs.readFile(this.abs(r), 'utf8')))
        } catch {
          this.ownWrites.set(r, GONE)
        }
      })
    )
  }

  // ── Watcher ───────────────────────────────────────────────────────────────

  private async onWatch(b: WatchBatch): Promise<void> {
    const changed: string[] = []
    const deleted: string[] = []
    let structural = b.structural
    let dirsChanged = false
    for (const rel of b.paths) {
      if (rel.startsWith(TRASH_DIR + '/') || rel === TRASH_DIR) continue
      if (rel === `${CONFIG_DIR}/vault.json`) {
        const before = JSON.stringify(this.config.order ?? {})
        this.config = await ensureVaultConfig(this.root, this.info.name)
        if (JSON.stringify(this.config.order ?? {}) !== before) structural = true
        continue
      }
      if (rel.startsWith(`${CONFIG_DIR}/templates`)) {
        this.opts.emit('templates:changed')
        continue
      }
      if (rel.split('/').some((seg) => seg.startsWith('.'))) {
        if (icloudTarget(rel)) structural = true
        continue
      }
      if (rel.split('/').includes(ASSETS_DIR)) continue
      if (!isMarkdown(rel)) {
        dirsChanged = true
        continue
      }
      if (isConflictCopy(rel)) {
        structural = true
        continue
      }
      let text: string | null
      try {
        text = await fs.readFile(this.abs(rel), 'utf8')
      } catch {
        text = null
      }
      const known = this.ownWrites.get(rel)
      if (text === null) {
        deleted.push(rel)
        if (known !== GONE) this.opts.emit('page:changed', rel)
        continue
      }
      if (known === hashText(text)) continue
      changed.push(rel)
      this.opts.emit('page:changed', rel)
    }
    this.opts.index.changed(changed)
    this.opts.index.deleted(deleted)
    if (dirsChanged) this.opts.index.sync()
    if (structural || dirsChanged || deleted.length) this.opts.emit('tree:changed')
  }

  // ── Conflicts ─────────────────────────────────────────────────────────────

  async readConflict(conflictRel: string): Promise<{ mine: string; theirs: string }> {
    const original = originalOfConflict(conflictRel)
    const theirs = await fs.readFile(this.abs(conflictRel), 'utf8')
    const mine = (await exists(this.abs(original)))
      ? await fs.readFile(this.abs(original), 'utf8')
      : ''
    return { mine, theirs }
  }

  async resolveConflict(
    conflictRel: string,
    action: 'keepMine' | 'takeTheirs' | 'keepBoth'
  ): Promise<void> {
    if (!isConflictCopy(conflictRel)) throw new Error('Keine Konfliktkopie')
    const original = originalOfConflict(conflictRel)
    if (action === 'takeTheirs') {
      const theirs = await fs.readFile(this.abs(conflictRel), 'utf8')
      await this.history.snapshot([original], 'Vor dem Auflösen eines Konflikts')
      await this.writeOwn(original, theirs)
      this.opts.emit('page:changed', original)
      await this.trash.put(conflictRel, stemOf(conflictRel))
    } else if (action === 'keepMine') {
      await this.trash.put(conflictRel, stemOf(conflictRel))
    } else {
      const dirAbs = path.dirname(this.abs(conflictRel))
      const stem = await freeName(dirAbs, `${stemOf(original)} (Kopie)`, '.md')
      const target = join(dirname(conflictRel), stem + '.md')
      const { raw, data, body } = splitFrontmatter(await fs.readFile(this.abs(conflictRel), 'utf8'))
      // The copy needs its own id, or it would collide with the original
      const fm = raw
        ? updateFrontmatter(raw, { id: ulid(), title: stem })
        : buildFrontmatter({ ...data, id: ulid(), title: stem })
      await this.writeOwn(target, fm + body)
      await fs.rm(this.abs(conflictRel), { force: true })
    }
    this.opts.emit('tree:changed')
    await this.tree()
  }

  // ── Favorites ─────────────────────────────────────────────────────────────

  favorites(): string[] {
    return this.config.favorites
  }

  async setFavorite(rel: string, on: boolean): Promise<string[]> {
    const set = this.config.favorites.filter((f) => f !== rel)
    if (on) set.push(rel)
    this.config.favorites = set
    await this.saveConfig()
    return set
  }

  private async saveConfig(): Promise<void> {
    await writeJson(path.join(this.root, CONFIG_DIR, 'vault.json'), this.config)
  }

  // ── Journal & Quick Capture ───────────────────────────────────────────────

  async journalToday(): Promise<string> {
    return this.journalDay(dayKey())
  }

  /**
   * Opens (and creates if needed) the journal page of a day (`2026-10-05`). The date is the
   * title; the app shows the weekday above it, so the page gets no extra heading.
   */
  async journalDay(day: string): Promise<string> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Ungültiges Datum')
    const rel = join(JOURNAL_DIR, `${day}.md`)
    if (!(await exists(this.abs(rel)))) {
      await this.writeOwn(rel, newPageFrontmatter(day, { tags: ['journal'] }))
      await this.hush([rel])
      this.opts.emit('tree:changed')
    }
    return rel
  }

  /** Appends a timestamped entry to today's journal page. */
  async captureAppend(text: string): Promise<string> {
    const rel = await this.journalToday()
    const current = await fs.readFile(this.abs(rel), 'utf8')
    const lines = text.trim().split(/\r?\n/)
    const entry =
      `- **${timeKey()}** ${lines[0]}` +
      lines
        .slice(1)
        .map((l) => `\n  ${l}`)
        .join('')
    const trimmed = current.replace(/\s+$/, '')
    const lastLine = trimmed.split('\n').pop() ?? ''
    const continuesList = /^\s*- \*\*\d\d:\d\d\*\*/.test(lastLine) || /^\s{2}\S/.test(lastLine)
    const next = trimmed + (continuesList ? '\n' : '\n\n') + entry + '\n'
    await this.writeOwn(rel, next)
    this.opts.emit('page:changed', rel)
    return rel
  }

  /**
   * Renames a tag (and its nested tags) on the given pages, in frontmatter and text. The state
   * before is kept in the version history. Returns how many pages changed.
   */
  async renameTag(paths: string[], from: string, to: string): Promise<number> {
    await this.history.snapshot(paths, 'Vor dem Umbenennen eines Tags')
    let count = 0
    for (const rel of paths) {
      let text: string
      try {
        text = await fs.readFile(this.abs(rel), 'utf8')
      } catch {
        continue
      }
      const next = renameTagInText(text, from, to)
      if (next === text) continue
      await this.writeOwn(rel, next)
      this.opts.emit('page:changed', rel)
      count++
    }
    await this.history.flush(paths)
    return count
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  async templates(): Promise<TemplateInfo[]> {
    const dirRel = `${CONFIG_DIR}/templates`
    try {
      const names = await fs.readdir(this.abs(dirRel))
      return names
        .filter((n) => isMarkdown(n) && !n.startsWith('.'))
        .sort(collator.compare)
        .map((n) => ({ name: stemOf(n), path: `${dirRel}/${n}` }))
    } catch {
      return []
    }
  }

  async renderTemplate(rel: string, title: string): Promise<string> {
    if (!rel.startsWith(`${CONFIG_DIR}/templates/`)) throw new Error('Keine Vorlage')
    const { body } = splitFrontmatter(await fs.readFile(this.abs(rel), 'utf8'))
    const now = new Date()
    const vars: Record<string, string> = {
      title,
      date: dayKey(now),
      time: timeKey(now),
      weekday: new Intl.DateTimeFormat(this.opts.locale?.() ?? 'de-DE', { weekday: 'long' }).format(
        now
      )
    }
    return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, k: string) => vars[k] ?? all)
  }

  // ── Links ─────────────────────────────────────────────────────────────────

  /**
   * Turns plain mentions of `title` in another page into `[[title]]` links. Code, existing links
   * and the frontmatter stay untouched. Returns how many mentions were linked, plus the text
   * before and the new hash so the change can be undone safely.
   */
  async linkMentions(
    sourceRel: string,
    title: string
  ): Promise<{ count: number; before: string; hash: string }> {
    const page = await this.read(sourceRel)
    const { raw, body } = splitFrontmatter(page.text)
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const skip = /\[\[[^\]\n]*\]\]|!?\[[^\]\n]*\]\([^)\n]*\)|<[^>\n]+>|https?:\/\/\S+/g
    const word = new RegExp(`(?<![\\p{L}\\p{N}_#])${escaped}(?![\\p{L}\\p{N}_])`, 'giu')
    let count = 0
    const linkPlain = (text: string): string =>
      text.replace(word, (m) => {
        count++
        return m === title ? `[[${title}]]` : `[[${title}|${m}]]`
      })
    const next = mapOutsideCode(body, (chunk) => {
      let out = ''
      let i = 0
      for (const m of chunk.matchAll(skip)) {
        out += linkPlain(chunk.slice(i, m.index)) + m[0]
        i = m.index! + m[0].length
      }
      return out + linkPlain(chunk.slice(i))
    })
    if (!count) return { count, before: page.text, hash: page.hash }
    await this.history.flush([sourceRel])
    await this.history.snapshot([sourceRel], 'Vor dem Verlinken')
    const hash = await this.writeOwn(sourceRel, raw + next)
    this.opts.emit('page:changed', sourceRel)
    return { count, before: page.text, hash }
  }

  /**
   * Finds the file an embed like `![[Bild.png]]` or `![[Ordner/Bild.png]]` points to: next to the
   * page and in its `_assets/` first, then anywhere in the vault (shortest path wins).
   */
  async resolveEmbed(pageRel: string, target: string): Promise<string | null> {
    const name = parseLinkTarget(target).page
    if (!name || !IMAGE_EXT_RE.test(name)) return null
    const candidates = [
      join(dirname(pageRel), name),
      join(childFolderOf(pageRel), ASSETS_DIR, name),
      name
    ]
    for (const c of candidates) {
      try {
        if (await exists(this.abs(c))) return c
      } catch {
        // path outside the vault
      }
    }
    const wanted = basename(name).toLowerCase()
    let best: string | null = null
    const walk = async (dirRel: string, depth: number): Promise<void> => {
      if (depth > 12) return
      let entries
      try {
        entries = await fs.readdir(dirRel ? this.abs(dirRel) : this.root, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        if (e.name.startsWith('.')) continue
        const rel = join(dirRel, e.name)
        if (e.isDirectory()) await walk(rel, depth + 1)
        else if (e.name.toLowerCase() === wanted && (!best || rel.length < best.length)) best = rel
      }
    }
    await walk('', 0)
    return best
  }

  relFromAbs(abs: string): string {
    return toRel(this.root, abs)
  }
}
