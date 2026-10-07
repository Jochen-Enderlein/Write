import { promises as fs } from 'node:fs'
import path from 'node:path'
import { IndexDb } from '../indexer/db'
import { extractPage } from '../indexer/extract'
import { scanMarkdown } from '../indexer/scan'
import type { VaultIndex } from '../main/vault'

/**
 * The vault's search index, used in-process by the MCP server. It shares the database file with
 * the app (SQLite in WAL mode copes with two processes) and catches up incrementally before
 * every query, so answers are current even while Write itself is closed.
 */
export class LocalIndex implements VaultIndex {
  private root = ''
  private file = ''
  private handle: IndexDb | null = null

  open(root: string, dbFile: string): void {
    this.handle?.close()
    this.root = root
    this.file = dbFile
    this.handle = null
  }

  get db(): IndexDb {
    if (!this.handle) {
      if (!this.file) throw new Error('Kein Vault geöffnet')
      this.handle = new IndexDb(this.file)
    }
    return this.handle
  }

  /** Brings the index up to date with the files on disk (only changed files are read). */
  async refresh(): Promise<void> {
    const db = this.db
    const files = await scanMarkdown(this.root)
    const known = db.stamps()
    const seen = new Set<string>()
    const changed: string[] = []
    for (const f of files) {
      seen.add(f.rel)
      const k = known.get(f.rel)
      if (!k || k.mtimeMs !== f.mtimeMs || k.size !== f.size) changed.push(f.rel)
    }
    const gone = [...known.keys()].filter((p) => !seen.has(p))
    await this.update(changed)
    if (gone.length) db.transaction(() => gone.forEach((p) => db.remove(p)))
  }

  private async update(rels: string[]): Promise<void> {
    if (!rels.length) return
    const loaded = await Promise.all(
      rels.map(async (rel) => {
        const abs = path.join(this.root, rel)
        try {
          const st = await fs.stat(abs)
          return { rel, st, raw: await fs.readFile(abs, 'utf8') }
        } catch {
          return { rel, st: null, raw: '' }
        }
      })
    )
    const db = this.db
    db.transaction(() => {
      for (const f of loaded) {
        if (!f.st) db.remove(f.rel)
        else db.upsert(f.rel, { mtimeMs: f.st.mtimeMs, size: f.st.size }, extractPage(f.rel, f.raw))
      }
    })
  }

  sync(): void {
    void this.refresh()
  }
  changed(paths: string[]): void {
    void this.update(paths)
  }
  deleted(paths: string[]): void {
    const db = this.db
    db.transaction(() => paths.forEach((p) => db.remove(p)))
  }
  async linkSources(titles: string[]): Promise<string[]> {
    await this.refresh()
    return this.db.linkSources(titles)
  }

  close(): void {
    this.handle?.close()
    this.handle = null
  }
}
