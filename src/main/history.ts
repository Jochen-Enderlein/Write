import fs from 'node:fs'
import git from 'isomorphic-git'
import type { HistoryEntry } from '@shared/types'

const author = { name: 'Write', email: 'write@localhost' }

/**
 * Per-vault snapshot repository. The work tree is the vault itself, the git dir lives in
 * Application Support, so nothing git-related is ever synced.
 */
export class History {
  private timers = new Map<string, NodeJS.Timeout>()
  private queue: Promise<unknown> = Promise.resolve()
  private ready: Promise<void>

  constructor(
    private readonly dir: string,
    private readonly gitdir: string,
    private readonly delayMs: () => number
  ) {
    this.ready = this.init()
  }

  private async init(): Promise<void> {
    await fs.promises.mkdir(this.gitdir, { recursive: true })
    if (!fs.existsSync(`${this.gitdir}/HEAD`)) {
      await git.init({ fs, dir: this.dir, gitdir: this.gitdir, defaultBranch: 'main' })
    }
  }

  /** Snapshot a page once writing has paused for a few seconds. */
  schedule(rel: string): void {
    clearTimeout(this.timers.get(rel))
    this.timers.set(
      rel,
      setTimeout(() => {
        this.timers.delete(rel)
        void this.snapshot([rel], 'Snapshot')
      }, this.delayMs())
    )
  }

  /** Commits the current state of the given files (missing files are recorded as removed). */
  snapshot(rels: string[], message: string): Promise<void> {
    const run = async (): Promise<void> => {
      await this.ready
      let changed = false
      for (const filepath of rels) {
        const [, head, work, stage] = (
          await git.statusMatrix({ fs, dir: this.dir, gitdir: this.gitdir, filepaths: [filepath] })
        )[0] ?? [filepath, 0, 0, 0]
        if (work === 0) {
          if (head === 1) {
            await git.remove({ fs, dir: this.dir, gitdir: this.gitdir, filepath })
            changed = true
          }
        } else if (head !== 1 || work !== 1 || stage !== 1) {
          await git.add({ fs, dir: this.dir, gitdir: this.gitdir, filepath })
          changed = true
        }
      }
      if (changed) {
        await git.commit({
          fs,
          dir: this.dir,
          gitdir: this.gitdir,
          author,
          message: `${message}\n\n${rels.join('\n')}`
        })
      }
    }
    const next = this.queue
      .then(run, run)
      .catch((err) => console.error('[history] Snapshot fehlgeschlagen', err))
    this.queue = next
    return next
  }

  /** Flushes pending snapshots right away (before rename, delete, quit). */
  async flush(rels?: string[]): Promise<void> {
    const pending = [...this.timers.keys()].filter((r) => !rels || rels.includes(r))
    for (const r of pending) clearTimeout(this.timers.get(r))
    pending.forEach((r) => this.timers.delete(r))
    if (pending.length) await this.snapshot(pending, 'Snapshot')
    await this.queue
  }

  async log(rel: string): Promise<HistoryEntry[]> {
    await this.ready
    await this.flush([rel])
    try {
      const commits = await git.log({
        fs,
        dir: this.dir,
        gitdir: this.gitdir,
        filepath: rel,
        depth: 300
      })
      return commits.map((c) => ({
        oid: c.oid,
        timestamp: c.commit.committer.timestamp * 1000,
        message: c.commit.message.split('\n')[0] ?? ''
      }))
    } catch {
      return []
    }
  }

  /**
   * Drops snapshots older than `days`: the newer commits are rewritten into a fresh chain (same
   * trees, messages and times) and objects nothing points to any more are deleted. Runs in the
   * snapshot queue, so it never races with a commit.
   */
  prune(days: number): Promise<void> {
    const run = async (): Promise<void> => {
      await this.ready
      const g = { fs, dir: this.dir, gitdir: this.gitdir }
      let commits
      try {
        commits = await git.log({ ...g, ref: 'main' })
      } catch {
        return // no commits yet
      }
      const cutoff = Date.now() / 1000 - days * 86400
      const recent = commits.filter((c) => c.commit.committer.timestamp >= cutoff)
      if (recent.length === commits.length) return
      // The newest snapshot always stays: the staging index points into its tree
      const keep = recent.length ? recent : commits.slice(0, 1)
      // Newest first → rebuild oldest first
      let parent: string | null = null
      for (const c of [...keep].reverse()) {
        parent = await git.writeCommit({
          ...g,
          commit: { ...c.commit, parent: parent ? [parent] : [] }
        })
      }
      if (!parent) return
      await git.writeRef({ ...g, ref: 'refs/heads/main', value: parent, force: true })

      // Everything still reachable from the new chain stays
      const reachable = new Set<string>()
      const walkTree = async (oid: string): Promise<void> => {
        if (reachable.has(oid)) return
        reachable.add(oid)
        const { tree } = await git.readTree({ ...g, oid })
        for (const e of tree) {
          if (e.type === 'tree') await walkTree(e.oid)
          else reachable.add(e.oid)
        }
      }
      let oid: string | null = parent
      while (oid) {
        reachable.add(oid)
        const { commit } = await git.readCommit({ ...g, oid })
        await walkTree(commit.tree)
        oid = commit.parent[0] ?? null
      }
      const objects = `${this.gitdir}/objects`
      for (const dir of await fs.promises.readdir(objects)) {
        if (!/^[0-9a-f]{2}$/.test(dir)) continue
        for (const file of await fs.promises.readdir(`${objects}/${dir}`)) {
          if (!reachable.has(dir + file)) await fs.promises.rm(`${objects}/${dir}/${file}`)
        }
      }
    }
    const next = this.queue
      .then(run, run)
      .catch((err) => console.error('[history] Aufräumen fehlgeschlagen', err))
    this.queue = next
    return next
  }

  async read(rel: string, oid: string): Promise<string> {
    await this.ready
    const { blob } = await git.readBlob({
      fs,
      dir: this.dir,
      gitdir: this.gitdir,
      oid,
      filepath: rel
    })
    return new TextDecoder().decode(blob)
  }
}
