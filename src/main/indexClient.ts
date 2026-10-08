import { utilityProcess, type UtilityProcess } from 'electron'
import path from 'node:path'
import type {
  GraphData,
  IndexStatus,
  PageMeta,
  PageSummary,
  PropKey,
  SearchHit,
  TableRow,
  TagCount
} from '@shared/types'
import type { IndexCommand, IndexMessage, QueryName } from '../indexer/protocol'

type Listener = { status(s: IndexStatus): void; updated(): void }

/** Talks to the index utility process; restarts it if it crashes. */
export class IndexClient {
  private proc: UtilityProcess | null = null
  private nextId = 1
  private waiting = new Map<number, { resolve(v: unknown): void; reject(e: Error): void }>()
  private openCmd: IndexCommand | null = null
  private closed = false

  constructor(private readonly listener: Listener) {}

  private ensure(): UtilityProcess {
    if (this.proc) return this.proc
    const proc = utilityProcess.fork(path.join(import.meta.dirname, 'indexer.js'), [], {
      serviceName: 'Write Index',
      stdio: 'inherit'
    })
    proc.on('message', (m: IndexMessage) => {
      if (m.type === 'result') {
        const w = this.waiting.get(m.id)
        this.waiting.delete(m.id)
        if (m.error) w?.reject(new Error(m.error))
        else w?.resolve(m.result)
      } else if (m.type === 'status') this.listener.status(m.status)
      else if (m.type === 'updated') this.listener.updated()
    })
    proc.on('exit', (code) => {
      this.proc = null
      for (const w of this.waiting.values()) w.reject(new Error('Index-Prozess beendet'))
      this.waiting.clear()
      if (!this.closed && code !== 0) {
        console.warn('[index] Prozess beendet, starte neu', code)
        if (this.openCmd) this.send(this.openCmd)
      }
    })
    this.proc = proc
    return proc
  }

  private send(cmd: IndexCommand): void {
    this.ensure().postMessage(cmd)
  }

  open(root: string, dbFile: string): void {
    this.openCmd = { type: 'open', root, dbFile }
    this.send(this.openCmd)
  }

  sync(): void {
    this.send({ type: 'sync' })
  }
  rebuild(): void {
    this.send({ type: 'rebuild' })
  }
  changed(paths: string[]): void {
    if (paths.length) this.send({ type: 'changed', paths })
  }
  deleted(paths: string[]): void {
    if (paths.length) this.send({ type: 'deleted', paths })
  }

  private query<T>(name: QueryName, ...args: unknown[]): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.send({ type: 'query', id, name, args })
    })
  }

  titles = (): Promise<PageMeta[]> => this.query('titles')
  search = (q: string, tag: string | null): Promise<SearchHit[]> => this.query('search', q, tag)
  backlinks = (p: string): Promise<SearchHit[]> => this.query('backlinks', p)
  mentions = (p: string): Promise<SearchHit[]> => this.query('mentions', p)
  tags = (): Promise<TagCount[]> => this.query('tags')
  graph = (): Promise<GraphData> => this.query('graph')
  tagPaths = (tag: string): Promise<string[]> => this.query('tagPaths', tag)
  resolve = (title: string): Promise<string | null> => this.query('resolve', title)
  linkSources = (titles: string[]): Promise<string[]> => this.query('linkSources', titles)
  summaries = (paths: string[]): Promise<PageSummary[]> => this.query('summaries', paths)
  table = (folder: string): Promise<TableRow[]> => this.query('table', folder)
  propKeys = (folder: string | null): Promise<PropKey[]> => this.query('propKeys', folder)
  status = (): Promise<IndexStatus> => this.query('status')

  close(): void {
    this.closed = true
    this.proc?.kill()
    this.proc = null
  }
}
