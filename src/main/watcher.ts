import { watch, type FSWatcher } from 'node:fs'
import path from 'node:path'

export interface WatchBatch {
  /** Vault-relative paths that changed (created, modified, deleted or renamed). */
  paths: string[]
  /** True if entries were added, removed or renamed (not just modified). */
  structural: boolean
}

/**
 * Watches the whole vault with one recursive FSEvents stream (fs.watch on macOS) and reports
 * debounced batches. One stream scales to tens of thousands of files, unlike per-folder watchers.
 */
export class VaultWatcher {
  private watcher: FSWatcher | null = null
  private paths = new Set<string>()
  private structural = false
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly root: string,
    private readonly onBatch: (b: WatchBatch) => void
  ) {}

  start(): void {
    this.watcher = watch(this.root, { recursive: true }, (event, filename) => {
      if (!filename) return
      const rel = filename.toString().split(path.sep).join('/')
      if (/(^|\/)\.[^/]+\.[0-9a-f]{8}\.tmp$/.test(rel) || rel.endsWith('.DS_Store')) return
      this.paths.add(rel)
      if (event === 'rename') this.structural = true
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => this.flush(), 150)
    })
    this.watcher.on('error', (err) => console.error('[watcher]', err))
  }

  private flush(): void {
    const batch = { paths: [...this.paths], structural: this.structural }
    this.paths.clear()
    this.structural = false
    this.timer = null
    this.onBatch(batch)
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.watcher?.close()
    this.watcher = null
  }
}
