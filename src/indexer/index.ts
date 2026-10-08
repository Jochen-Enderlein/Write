/**
 * Index process (Electron utilityProcess). Owns the SQLite database of the open vault, parses
 * changed files and answers queries. Work is done in small batches so queries stay fast.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { IndexStatus } from '@shared/types'
import { isConflictCopy } from '@shared/conflicts'
import { IndexDb } from './db'
import { extractPage } from './extract'
import { scanMarkdown } from './scan'
import type { IndexCommand, IndexMessage } from './protocol'

const port = (
  process as unknown as {
    parentPort: {
      on(e: 'message', cb: (ev: { data: IndexCommand }) => void): void
      postMessage(m: IndexMessage): void
    }
  }
).parentPort

let root = ''
let db: IndexDb | null = null
let status: IndexStatus = { state: 'idle', done: 0, total: 0 }
const pending = new Set<string>()
let draining = false

const post = (m: IndexMessage): void => port.postMessage(m)
const tick = (): Promise<void> => new Promise((r) => setImmediate(r))

function setStatus(s: IndexStatus): void {
  status = s
  post({ type: 'status', status })
}

/** Processes the pending set in batches, yielding between them for queries. */
async function drain(): Promise<void> {
  if (draining || !db) return
  draining = true
  try {
    let done = 0
    while (pending.size > 0) {
      const total = done + pending.size
      const batch = [...pending].slice(0, 100)
      batch.forEach((p) => pending.delete(p))
      const loaded = await Promise.all(
        batch.map(async (rel) => {
          const abs = path.join(root, rel)
          try {
            const st = await fs.stat(abs)
            return { rel, st, raw: await fs.readFile(abs, 'utf8') }
          } catch {
            return { rel, st: null, raw: '' }
          }
        })
      )
      db.transaction(() => {
        for (const f of loaded) {
          if (!f.st) db!.remove(f.rel)
          else
            db!.upsert(f.rel, { mtimeMs: f.st.mtimeMs, size: f.st.size }, extractPage(f.rel, f.raw))
        }
      })
      done += batch.length
      if (total > 20) setStatus({ state: 'indexing', done, total })
      await tick()
    }
  } finally {
    draining = false
    setStatus({ state: 'idle', done: 0, total: 0 })
    post({ type: 'updated' })
  }
}

async function sync(): Promise<void> {
  if (!db) return
  setStatus({ state: 'indexing', done: 0, total: 0 })
  const files = await scanMarkdown(root)
  const known = db.stamps()
  const seen = new Set<string>()
  for (const f of files) {
    seen.add(f.rel)
    const k = known.get(f.rel)
    if (!k || k.mtimeMs !== f.mtimeMs || k.size !== f.size) pending.add(f.rel)
  }
  const gone = [...known.keys()].filter((p) => !seen.has(p))
  if (gone.length) db.transaction(() => gone.forEach((p) => db!.remove(p)))
  await drain()
}

function query(name: string, args: unknown[]): unknown {
  if (name === 'status') return status
  if (!db) throw new Error('Kein Index geöffnet')
  switch (name) {
    case 'titles':
      return db.titles()
    case 'search':
      return db.search(String(args[0] ?? ''), (args[1] as string | null) ?? null)
    case 'backlinks':
      return db.backlinks(String(args[0]))
    case 'mentions':
      return db.mentions(String(args[0]))
    case 'tags':
      return db.tags()
    case 'graph':
      return db.graph()
    case 'tagPaths':
      return db.tagPaths(String(args[0]))
    case 'resolve':
      return db.resolve(String(args[0]))
    case 'linkSources':
      return db.linkSources(args[0] as string[])
    case 'summaries':
      return db.summaries(args[0] as string[])
    case 'table':
      return db.table(String(args[0] ?? ''))
    case 'propKeys':
      return db.propKeys((args[0] as string | null) ?? null)
    default:
      throw new Error(`Unbekannte Abfrage: ${name}`)
  }
}

port.on('message', ({ data: cmd }) => {
  switch (cmd.type) {
    case 'open':
      db?.close()
      root = cmd.root
      db = new IndexDb(cmd.dbFile)
      void sync()
      break
    case 'sync':
      void sync()
      break
    case 'rebuild':
      db?.reset()
      void sync()
      break
    case 'changed':
      for (const p of cmd.paths) if (!isConflictCopy(p)) pending.add(p)
      void drain()
      break
    case 'deleted':
      if (db) db.transaction(() => cmd.paths.forEach((p) => db!.remove(p)))
      post({ type: 'updated' })
      break
    case 'query':
      try {
        post({ type: 'result', id: cmd.id, result: query(cmd.name, cmd.args) })
      } catch (err) {
        post({ type: 'result', id: cmd.id, error: String(err) })
      }
      break
  }
})
