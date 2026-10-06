import { createHash, randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export function hashText(text: string | Uint8Array): string {
  return createHash('sha1').update(text).digest('hex')
}

/** Writes via a temp file in the same folder plus rename, so readers never see half a file. */
export async function atomicWrite(file: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${randomBytes(4).toString('hex')}.tmp`
  )
  try {
    await fs.writeFile(tmp, data)
    await fs.rename(tmp, file)
  } catch (err) {
    await fs.rm(tmp, { force: true })
    throw err
  }
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/** Resolves a vault-relative POSIX path and refuses anything that escapes the vault. */
export function resolveInside(root: string, rel: string): string {
  const abs = path.resolve(root, ...rel.split('/'))
  const rootAbs = path.resolve(root)
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep))
    throw new Error(`Pfad außerhalb des Vaults: ${rel}`)
  return abs
}

export function toRel(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/')
}

/** Picks a free name: `Name.md`, `Name 2.md`, `Name 3.md` … */
export async function freeName(
  dir: string,
  stem: string,
  ext: string,
  isFree?: (stem: string) => Promise<boolean>
): Promise<string> {
  for (let i = 1; i < 10_000; i++) {
    const candidate = i === 1 ? stem : `${stem} ${i}`
    const free = isFree ? await isFree(candidate) : !(await exists(path.join(dir, candidate + ext)))
    if (free) return candidate
  }
  throw new Error('Kein freier Name gefunden')
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  await atomicWrite(file, JSON.stringify(data, null, 2) + '\n')
}

export async function isEmptyDir(dir: string): Promise<boolean> {
  try {
    const entries = (await fs.readdir(dir)).filter((e) => e !== '.DS_Store')
    return entries.length === 0
  } catch {
    return false
  }
}
