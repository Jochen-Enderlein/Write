import { promises as fs } from 'node:fs'
import path from 'node:path'
import { atomicWrite, exists } from './fsutil'

/**
 * A tiny file-operation transaction: every step registers how to undo itself, and `rollback`
 * replays those in reverse. Used for rename/move, which touch many files at once.
 */
export class FileTx {
  private undo: (() => Promise<void>)[] = []

  async write(abs: string, data: string): Promise<void> {
    const before = (await exists(abs)) ? await fs.readFile(abs) : null
    await atomicWrite(abs, data)
    this.undo.push(async () => {
      if (before === null) await fs.rm(abs, { force: true })
      else await atomicWrite(abs, before)
    })
  }

  async rename(from: string, to: string): Promise<void> {
    await fs.mkdir(path.dirname(to), { recursive: true })
    await fs.rename(from, to)
    this.undo.push(() => fs.rename(to, from))
  }

  async mkdir(dir: string): Promise<void> {
    if (await exists(dir)) return
    await fs.mkdir(dir, { recursive: true })
    this.undo.push(async () => {
      await fs.rmdir(dir).catch(() => undefined)
    })
  }

  async rollback(): Promise<void> {
    for (const step of this.undo.reverse()) {
      try {
        await step()
      } catch (err) {
        console.error('[tx] Rollback-Schritt fehlgeschlagen', err)
      }
    }
    this.undo = []
  }
}

/** Runs `fn` inside a transaction and rolls back everything if it throws. */
export async function withTx<T>(fn: (tx: FileTx) => Promise<T>): Promise<T> {
  const tx = new FileTx()
  try {
    return await fn(tx)
  } catch (err) {
    await tx.rollback()
    throw err
  }
}
