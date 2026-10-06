import { promises as fs } from 'node:fs'
import path from 'node:path'
import { isConflictCopy } from '@shared/conflicts'
import { ASSETS_DIR } from '@shared/paths'

export interface ScannedFile {
  rel: string
  mtimeMs: number
  size: number
}

/** All indexable markdown files of the vault (no hidden folders, assets or conflict copies). */
export async function scanMarkdown(root: string): Promise<ScannedFile[]> {
  const out: ScannedFile[] = []
  async function walk(dirRel: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(path.join(root, dirRel), { withFileTypes: true })
    } catch {
      return
    }
    const subdirs: Promise<void>[] = []
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === ASSETS_DIR) continue
      const rel = dirRel ? `${dirRel}/${e.name}` : e.name
      if (e.isDirectory()) subdirs.push(walk(rel))
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md') && !isConflictCopy(rel)) {
        out.push({ rel, mtimeMs: 0, size: 0 })
      }
    }
    await Promise.all(subdirs)
  }
  await walk('')
  await Promise.all(
    out.map(async (f) => {
      try {
        const st = await fs.stat(path.join(root, f.rel))
        f.mtimeMs = st.mtimeMs
        f.size = st.size
      } catch {
        f.size = -1
      }
    })
  )
  return out.filter((f) => f.size >= 0)
}
