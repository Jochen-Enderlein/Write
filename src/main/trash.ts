import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { TrashEntry } from '@shared/types'
import { TRASH_DIR, childFolderOf, dirname, join, stemOf } from '@shared/paths'
import { exists, freeName, readJson, resolveInside, writeJson } from './fsutil'

interface TrashMeta {
  title: string
  originalPath: string
  deletedAt: string
  hasFolder: boolean
  /** Missing in entries from before folders could be trashed */
  kind?: 'page' | 'folder'
}

export interface Restored {
  path: string
  kind: 'page' | 'folder'
  /** Whether a folder with sub-pages came back too */
  folder: boolean
}

/**
 * The vault's trash lives in `.trash/` inside the vault, so it syncs like everything else.
 * Each deleted page gets its own folder holding the file, its sub-page folder and `meta.json`.
 */
export class Trash {
  constructor(private readonly root: string) {}

  private dir(id = ''): string {
    return path.join(this.root, TRASH_DIR, id)
  }

  async put(rel: string, title: string): Promise<string> {
    const id = `${Date.now()}-${randomBytes(3).toString('hex')}`
    const target = this.dir(id)
    await fs.mkdir(target, { recursive: true })
    const folderAbs = resolveInside(this.root, childFolderOf(rel))
    const hasFolder = await exists(folderAbs)
    await fs.rename(resolveInside(this.root, rel), path.join(target, path.basename(rel)))
    if (hasFolder) await fs.rename(folderAbs, path.join(target, stemOf(rel)))
    const meta: TrashMeta = {
      title,
      originalPath: rel,
      deletedAt: new Date().toISOString(),
      hasFolder
    }
    await writeJson(path.join(target, 'meta.json'), meta)
    return id
  }

  /** Moves a plain folder with everything in it into the trash. */
  async putFolder(rel: string): Promise<string> {
    const id = `${Date.now()}-${randomBytes(3).toString('hex')}`
    const target = this.dir(id)
    await fs.mkdir(target, { recursive: true })
    await fs.rename(resolveInside(this.root, rel), path.join(target, path.basename(rel)))
    const meta: TrashMeta = {
      title: path.basename(rel),
      originalPath: rel,
      deletedAt: new Date().toISOString(),
      hasFolder: true,
      kind: 'folder'
    }
    await writeJson(path.join(target, 'meta.json'), meta)
    return id
  }

  async list(): Promise<TrashEntry[]> {
    let ids: string[]
    try {
      ids = (await fs.readdir(this.dir())).filter((n) => !n.startsWith('.'))
    } catch {
      return []
    }
    const entries = await Promise.all(
      ids.map(async (id) => {
        const meta = await readJson<TrashMeta | null>(path.join(this.dir(id), 'meta.json'), null)
        return meta
          ? {
              id,
              title: meta.title,
              originalPath: meta.originalPath,
              deletedAt: meta.deletedAt,
              kind: meta.kind ?? 'page'
            }
          : null
      })
    )
    return entries
      .filter((e): e is TrashEntry => e !== null)
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  }

  /** Moves a page back to where it was; picks a new name if that spot is taken. Returns the new path. */
  async restore(id: string): Promise<Restored> {
    if (id.includes('/') || id.includes('..')) throw new Error('Ungültige ID')
    const src = this.dir(id)
    const meta = await readJson<TrashMeta | null>(path.join(src, 'meta.json'), null)
    if (!meta) throw new Error('Eintrag nicht gefunden')
    const parentRel = dirname(meta.originalPath)
    const parentAbs = resolveInside(this.root, parentRel || '.')
    await fs.mkdir(parentAbs, { recursive: true })
    const taken = async (s: string, ext: string): Promise<boolean> =>
      (await exists(path.join(parentAbs, s + ext))) || (await exists(path.join(parentAbs, s)))
    if (meta.kind === 'folder') {
      const name = await freeName(
        parentAbs,
        path.basename(meta.originalPath),
        '',
        async (s) => !(await taken(s, '.md'))
      )
      await fs.rename(path.join(src, path.basename(meta.originalPath)), path.join(parentAbs, name))
      await fs.rm(src, { recursive: true, force: true })
      return { path: join(parentRel, name), kind: 'folder', folder: true }
    }
    const oldStem = stemOf(meta.originalPath)
    const stem = await freeName(
      parentAbs,
      oldStem,
      '.md',
      async (s) =>
        !(await exists(path.join(parentAbs, s + '.md'))) && !(await exists(path.join(parentAbs, s)))
    )
    await fs.rename(
      path.join(src, path.basename(meta.originalPath)),
      path.join(parentAbs, stem + '.md')
    )
    if (meta.hasFolder && (await exists(path.join(src, oldStem)))) {
      await fs.rename(path.join(src, oldStem), path.join(parentAbs, stem))
    }
    await fs.rm(src, { recursive: true, force: true })
    return { path: join(parentRel, stem + '.md'), kind: 'page', folder: meta.hasFolder }
  }

  async remove(id: string): Promise<void> {
    if (!id || id.includes('/') || id.includes('..')) throw new Error('Ungültige ID')
    await fs.rm(this.dir(id), { recursive: true, force: true })
  }

  async empty(): Promise<void> {
    for (const e of await this.list()) await this.remove(e.id)
  }

  /** Removes entries older than `days`. */
  async purge(days: number): Promise<void> {
    if (days <= 0) return
    const cutoff = Date.now() - days * 86_400_000
    for (const e of await this.list()) if (Date.parse(e.deletedAt) < cutoff) await this.remove(e.id)
  }
}
