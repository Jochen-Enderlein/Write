import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Vault } from '../../src/main/vault'
import type { IndexClient } from '../../src/main/indexClient'
import { IndexDb } from '../../src/indexer/db'
import { extractPage } from '../../src/indexer/extract'
import { scanMarkdown } from '../../src/indexer/scan'

const noop = (): void => undefined
const fakeIndex = {
  open: noop,
  sync: noop,
  changed: noop,
  deleted: noop,
  close: noop
} as unknown as IndexClient

describe.each([5000, 20000])('Vault mit %i Seiten', (count) => {
  const base = mkdtempSync(path.join(tmpdir(), `write-perf-${count}-`))
  const root = path.join(base, 'vault')
  execFileSync(process.execPath, ['scripts/generate-vault.mjs', root, String(count)])

  it('baut den Seitenbaum schnell auf', async () => {
    const vault = new Vault(
      { id: 'p', name: 'P', path: root },
      {
        dataDir: path.join(base, 'data'),
        index: fakeIndex,
        emit: noop,
        snapshotDelayMs: () => 1000,
        trashRetentionDays: () => 0
      }
    )
    const t0 = performance.now()
    const tree = await vault.tree()
    const ms = performance.now() - t0
    console.log(`[perf] ${count} Seiten: Baum in ${ms.toFixed(0)} ms (${tree.length} Wurzelknoten)`)
    if (count === 5000) expect(ms).toBeLessThan(1000)
  })

  it('indexiert vollständig und sucht unter 100 ms', async () => {
    const db = new IndexDb(path.join(base, 'index.sqlite'))
    const t0 = performance.now()
    const files = await scanMarkdown(root)
    for (let i = 0; i < files.length; i += 100) {
      const batch = files
        .slice(i, i + 100)
        .map((f) => ({ f, raw: readFileSync(path.join(root, f.rel), 'utf8') }))
      db.transaction(() =>
        batch.forEach(({ f, raw }) => db.upsert(f.rel, f, extractPage(f.rel, raw)))
      )
    }
    const indexMs = performance.now() - t0
    expect(db.count()).toBe(count)

    const queries = [
      'architektur',
      'planung notiz',
      'synchro',
      'zusammenfassung konflikt vorlage',
      'xyzunbekannt'
    ]
    const times = queries.map((q) => {
      const s = performance.now()
      db.search(q, null)
      return performance.now() - s
    })
    const s = performance.now()
    db.backlinks(files[0]!.rel)
    const backMs = performance.now() - s
    const worst = Math.max(...times)
    console.log(
      `[perf] ${count} Seiten: Erstindexierung ${indexMs.toFixed(0)} ms, Suche max ${worst.toFixed(1)} ms, Backlinks ${backMs.toFixed(1)} ms`
    )
    expect(worst).toBeLessThan(100)
  })
})
