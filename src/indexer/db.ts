import Database from 'better-sqlite3'
import type { GraphData, PageMeta, PageSummary, SearchHit, TagCount } from '@shared/types'
import { normalizeTitle, parseLinkTarget } from '@shared/wikilinks'
import { stemOf } from '@shared/paths'
import type { ExtractedPage } from './extract'

const SCHEMA_VERSION = '4'

export const SNIPPET_OPEN = '\u0001'
export const SNIPPET_CLOSE = '\u0002'

export interface FileStamp {
  mtimeMs: number
  size: number
}

/** SQLite index of one vault: pages, links, tags and an FTS5 full-text table. */
export class IndexDb {
  readonly db: Database.Database

  constructor(file: string) {
    this.db = new Database(file)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    // The app and the MCP server may both write; wait for the other instead of failing
    this.db.pragma('busy_timeout = 5000')
    const version = this.db.prepare(`SELECT name FROM sqlite_master WHERE name = 'meta'`).get()
      ? (
          this.db.prepare(`SELECT value FROM meta WHERE key = 'schema'`).get() as
            { value: string } | undefined
        )?.value
      : undefined
    if (version !== SCHEMA_VERSION) this.reset()
  }

  reset(): void {
    this.db.exec(`
      DROP TABLE IF EXISTS pages; DROP TABLE IF EXISTS links; DROP TABLE IF EXISTS tags;
      DROP TABLE IF EXISTS pages_fts; DROP TABLE IF EXISTS meta;
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE pages (
        docid INTEGER PRIMARY KEY, path TEXT NOT NULL UNIQUE, id TEXT, title TEXT NOT NULL, title_norm TEXT NOT NULL,
        stem_norm TEXT NOT NULL, icon TEXT, mtime REAL NOT NULL, size INTEGER NOT NULL
      );
      CREATE INDEX pages_title ON pages(title_norm);
      CREATE INDEX pages_stem ON pages(stem_norm);
      CREATE TABLE links (source TEXT NOT NULL, target_norm TEXT NOT NULL);
      CREATE INDEX links_target ON links(target_norm);
      CREATE INDEX links_source ON links(source);
      CREATE TABLE tags (path TEXT NOT NULL, tag TEXT NOT NULL);
      CREATE INDEX tags_tag ON tags(tag);
      CREATE INDEX tags_path ON tags(path);
      -- rowid = pages.docid, so updates and deletes never scan the FTS table
      CREATE VIRTUAL TABLE pages_fts USING fts5(
        title, body, tokenize = 'unicode61 remove_diacritics 2'
      );
    `)
    this.db.prepare(`INSERT INTO meta (key, value) VALUES ('schema', ?)`).run(SCHEMA_VERSION)
  }

  stamps(): Map<string, FileStamp> {
    const rows = this.db.prepare(`SELECT path, mtime, size FROM pages`).all() as {
      path: string
      mtime: number
      size: number
    }[]
    return new Map(rows.map((r) => [r.path, { mtimeMs: r.mtime, size: r.size }]))
  }

  private cache = new Map<string, Database.Statement>()
  private stmt(sql: string): Database.Statement {
    let s = this.cache.get(sql)
    if (!s) this.cache.set(sql, (s = this.db.prepare(sql)))
    return s
  }

  upsert(path: string, stamp: FileStamp, p: ExtractedPage): void {
    this.remove(path)
    const { lastInsertRowid } = this.stmt(
      `INSERT INTO pages (path, id, title, title_norm, stem_norm, icon, mtime, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      path,
      p.id,
      p.title,
      normalizeTitle(p.title),
      normalizeTitle(stemOf(path)),
      p.icon,
      stamp.mtimeMs,
      stamp.size
    )
    const link = this.stmt(`INSERT INTO links (source, target_norm) VALUES (?, ?)`)
    for (const l of p.links) link.run(path, l)
    const tag = this.stmt(`INSERT INTO tags (path, tag) VALUES (?, ?)`)
    for (const t of p.tags) tag.run(path, t)
    this.stmt(`INSERT INTO pages_fts (rowid, title, body) VALUES (?, ?, ?)`).run(
      lastInsertRowid,
      p.title,
      p.text
    )
  }

  touch(path: string, stamp: FileStamp): void {
    this.stmt(`UPDATE pages SET mtime = ?, size = ? WHERE path = ?`).run(
      stamp.mtimeMs,
      stamp.size,
      path
    )
  }

  remove(path: string): void {
    const row = this.stmt(`SELECT docid FROM pages WHERE path = ?`).get(path) as
      { docid: number } | undefined
    if (row) this.stmt(`DELETE FROM pages_fts WHERE rowid = ?`).run(row.docid)
    this.stmt(`DELETE FROM pages WHERE path = ?`).run(path)
    this.stmt(`DELETE FROM links WHERE source = ?`).run(path)
    this.stmt(`DELETE FROM tags WHERE path = ?`).run(path)
  }

  transaction(fn: () => void): void {
    this.db.transaction(fn)()
  }

  titles(): PageMeta[] {
    const rows = this.stmt(
      `SELECT p.path, p.id, p.title, p.icon, group_concat(t.tag, ' ') AS tags
       FROM pages p LEFT JOIN tags t ON t.path = p.path GROUP BY p.path ORDER BY p.title COLLATE NOCASE`
    ).all() as {
      path: string
      id: string | null
      title: string
      icon: string | null
      tags: string | null
    }[]
    return rows.map((r) => ({
      path: r.path,
      id: r.id,
      title: r.title,
      icon: r.icon,
      tags: r.tags ? r.tags.split(' ') : []
    }))
  }

  search(query: string, tag: string | null, limit = 50): SearchHit[] {
    const fts = toFtsQuery(query)
    if (!fts && !tag) return []
    if (!fts) {
      return this.stmt(
        `SELECT p.path, p.title, p.icon, substr(f.body, 1, 160) AS snippet FROM tags t
         JOIN pages p ON p.path = t.path JOIN pages_fts f ON f.rowid = p.docid
         WHERE t.tag = ? OR t.tag LIKE ? ESCAPE '\\' GROUP BY p.path ORDER BY p.title COLLATE NOCASE LIMIT ?`
      ).all(tag, escapeLike(tag ?? '') + '/%', limit) as SearchHit[]
    }
    // A tag also finds its nested tags (`projekt` → `projekt/write`)
    const tagJoin = tag
      ? `JOIN (SELECT DISTINCT path FROM tags WHERE tag = @tag OR tag LIKE @nested ESCAPE '\\') t ON t.path = p.path`
      : ''
    return this.stmt(
      `SELECT p.path, p.title, p.icon,
              snippet(pages_fts, 1, '${SNIPPET_OPEN}', '${SNIPPET_CLOSE}', '…', 14) AS snippet
       FROM pages_fts f JOIN pages p ON p.docid = f.rowid ${tagJoin}
       WHERE pages_fts MATCH @q ORDER BY bm25(pages_fts, 8, 1) LIMIT @limit`
    ).all({ q: fts, tag, nested: tag ? escapeLike(tag) + '/%' : null, limit }) as SearchHit[]
  }

  /** Preview data for the given pages (folder overview); unknown paths are left out. */
  summaries(paths: string[]): PageSummary[] {
    if (!paths.length) return []
    const rows: PageSummary[] = []
    const q = this.stmt(
      `SELECT p.path, p.title, p.icon, substr(f.body, 1, 240) AS snippet, p.mtime AS mtimeMs
       FROM pages p JOIN pages_fts f ON f.rowid = p.docid WHERE p.path = ?`
    )
    for (const path of paths) {
      const row = q.get(path) as PageSummary | undefined
      if (row) rows.push(row)
    }
    return rows
  }

  /** Pages linking to the page at `path` (by title, file name or vault path like `Ordner/Seite`). */
  backlinks(path: string): SearchHit[] {
    const page = this.stmt(`SELECT title_norm, stem_norm FROM pages WHERE path = ?`).get(path) as
      { title_norm: string; stem_norm: string } | undefined
    if (!page) return []
    const pathNorm = normalizeTitle(path.replace(/\.md$/i, ''))
    return this.stmt(
      `SELECT DISTINCT p.path, p.title, p.icon, substr(f.body, 1, 160) AS snippet
       FROM links l JOIN pages p ON p.path = l.source JOIN pages_fts f ON f.rowid = p.docid
       WHERE (l.target_norm IN (?, ?, ?) OR (instr(l.target_norm, '/') > 0 AND ? LIKE '%/' || l.target_norm ESCAPE '\\'))
         AND l.source <> ? ORDER BY p.title COLLATE NOCASE`
    ).all(page.title_norm, page.stem_norm, pathNorm, pathNorm, path) as SearchHit[]
  }

  /**
   * Pages that mention the title of `path` in their text without linking to it. Titles shorter
   * than three characters would match nearly everything and are skipped.
   */
  mentions(path: string, limit = 30): SearchHit[] {
    const page = this.stmt(`SELECT title FROM pages WHERE path = ?`).get(path) as
      { title: string } | undefined
    if (!page || page.title.trim().length < 3) return []
    const phrase = `"${page.title.replace(/"/g, '""')}"`
    const linked = new Set(this.backlinks(path).map((h) => h.path))
    const hits = this.stmt(
      `SELECT p.path, p.title, p.icon,
              snippet(pages_fts, 1, '${SNIPPET_OPEN}', '${SNIPPET_CLOSE}', '…', 14) AS snippet
       FROM pages_fts f JOIN pages p ON p.docid = f.rowid
       WHERE pages_fts MATCH @q AND p.path <> @path ORDER BY bm25(pages_fts, 8, 1) LIMIT @limit`
    ).all({ q: `body : ${phrase}`, path, limit: limit + linked.size }) as SearchHit[]
    return hits.filter((h) => !linked.has(h.path)).slice(0, limit)
  }

  /** Files containing links to any of the given titles (also as `Ordner/Titel`). */
  linkSources(titles: string[]): string[] {
    const norms = [...new Set(titles.map(normalizeTitle))]
    const rows = this.db
      .prepare(
        `SELECT DISTINCT source FROM links WHERE target_norm IN (${norms.map(() => '?').join(',')})
         ${norms.map(() => `OR target_norm LIKE '%/' || ? ESCAPE '\\'`).join(' ')}`
      )
      .all(...norms, ...norms.map(escapeLike)) as { source: string }[]
    return rows.map((r) => r.source)
  }

  /**
   * Resolves a wiki-link target to a page path. `Seite#Abschnitt` resolves to `Seite`; a target
   * with a slash is matched against vault paths (`Ordner/Seite`), otherwise exact title first,
   * then file name.
   */
  resolve(target: string): string | null {
    const n = normalizeTitle(parseLinkTarget(target).page)
    if (!n) return null
    if (n.includes('/')) {
      const row = this.stmt(
        `SELECT path FROM pages WHERE lower(path) = ? OR lower(path) LIKE ? ESCAPE '\\'
         ORDER BY length(path) LIMIT 1`
      ).get(n + '.md', '%/' + escapeLike(n) + '.md') as { path: string } | undefined
      if (row) return row.path
    }
    const row = (this.stmt(
      `SELECT path FROM pages WHERE title_norm = ? ORDER BY length(path) LIMIT 1`
    ).get(n) ??
      this.stmt(`SELECT path FROM pages WHERE stem_norm = ? ORDER BY length(path) LIMIT 1`).get(
        n
      )) as { path: string } | undefined
    return row?.path ?? null
  }

  /** Pages carrying a tag or one of its nested tags. */
  tagPaths(tag: string): string[] {
    return (
      this.stmt(
        `SELECT DISTINCT path FROM tags WHERE tag = ? OR tag LIKE ? ESCAPE '\\' ORDER BY path`
      ).all(tag, escapeLike(tag) + '/%') as { path: string }[]
    ).map((r) => r.path)
  }

  /**
   * Every tag with the number of pages a search for it finds – nested tags included and each
   * page counted once (`projekt` counts pages with `projekt` or `projekt/…`). Parents that only
   * exist through nested tags are listed too.
   */
  tags(): TagCount[] {
    const pages = new Map<string, Set<string>>()
    for (const { path, tag } of this.stmt(`SELECT path, tag FROM tags`).all() as {
      path: string
      tag: string
    }[]) {
      const parts = tag.split('/')
      for (let i = 1; i <= parts.length; i++) {
        const prefix = parts.slice(0, i).join('/')
        if (!prefix) continue
        const set = pages.get(prefix) ?? new Set<string>()
        set.add(path)
        pages.set(prefix, set)
      }
    }
    return [...pages]
      .map(([tag, set]) => ({ tag, count: set.size }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }

  /**
   * All pages with their links resolved like resolve() does: a target with a slash by vault
   * path, otherwise by title first, then file name; the shortest path wins ties.
   */
  graph(): GraphData {
    const rows = this.stmt(
      `SELECT path, title, icon, title_norm, stem_norm FROM pages ORDER BY length(path), path`
    ).all() as {
      path: string
      title: string
      icon: string | null
      title_norm: string
      stem_norm: string
    }[]
    const index = new Map<string, number>()
    const byTitle = new Map<string, number>()
    const byStem = new Map<string, number>()
    const byPath = new Map<string, number>()
    rows.forEach((r, i) => {
      index.set(r.path, i)
      if (!byTitle.has(r.title_norm)) byTitle.set(r.title_norm, i)
      if (!byStem.has(r.stem_norm)) byStem.set(r.stem_norm, i)
      byPath.set(normalizeTitle(r.path.replace(/\.md$/i, '')), i)
    })
    const pathEntries = [...byPath]
    const resolve = (n: string): number | undefined => {
      if (n.includes('/')) {
        const exact = byPath.get(n)
        if (exact !== undefined) return exact
        const suffix = pathEntries.find(([p]) => p.endsWith('/' + n))
        if (suffix) return suffix[1]
      }
      return byTitle.get(n) ?? byStem.get(n)
    }

    const tags = new Map<string, string[]>()
    for (const t of this.stmt(`SELECT path, tag FROM tags ORDER BY tag`).all() as {
      path: string
      tag: string
    }[]) {
      const list = tags.get(t.path)
      if (list) list.push(t.tag)
      else tags.set(t.path, [t.tag])
    }

    const links: [number, number][] = []
    const seen = new Set<string>()
    const ghosts = new Map<string, Set<number>>()
    for (const l of this.stmt(`SELECT source, target_norm FROM links`).all() as {
      source: string
      target_norm: string
    }[]) {
      const from = index.get(l.source)
      if (from === undefined) continue
      const to = resolve(l.target_norm)
      if (to === undefined) {
        const g = ghosts.get(l.target_norm) ?? new Set<number>()
        g.add(from)
        ghosts.set(l.target_norm, g)
      } else if (to !== from && !seen.has(`${from}>${to}`)) {
        seen.add(`${from}>${to}`)
        links.push([from, to])
      }
    }
    return {
      pages: rows.map((r) => ({
        path: r.path,
        title: r.title,
        icon: r.icon,
        tags: tags.get(r.path) ?? []
      })),
      links,
      ghosts: [...ghosts].map(([title, from]) => ({ title, from: [...from] }))
    }
  }

  count(): number {
    return (this.stmt(`SELECT count(*) AS n FROM pages`).get() as { n: number }).n
  }

  close(): void {
    this.db.close()
  }
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => '\\' + c)
}

/** Turns user input into a safe FTS5 query: every word as a quoted prefix term, AND-combined. */
export function toFtsQuery(input: string): string {
  const terms = input
    .split(/\s+/)
    .map((t) => t.replace(/["]/g, '').trim())
    .filter(Boolean)
  return terms.map((t) => `"${t}"*`).join(' ')
}
