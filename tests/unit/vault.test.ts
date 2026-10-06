import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Vault } from '../../src/main/vault'
import type { IndexClient } from '../../src/main/indexClient'
import { extractWikilinks, normalizeTitle } from '@shared/wikilinks'
import { readHeader } from '@shared/page'

/** Minimal in-memory stand-in for the index process. */
function fakeIndex(root: string): IndexClient {
  const linkSources = async (titles: string[]): Promise<string[]> => {
    const wanted = new Set(titles.map(normalizeTitle))
    const out: string[] = []
    const walk = (dir: string): void => {
      for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue
        const rel = dir ? `${dir}/${e.name}` : e.name
        if (e.isDirectory()) walk(rel)
        else if (
          rel.endsWith('.md') &&
          extractWikilinks(readFileSync(path.join(root, rel), 'utf8')).some((l) =>
            wanted.has(normalizeTitle(l))
          )
        )
          out.push(rel)
      }
    }
    walk('')
    return out
  }
  const noop = (): void => undefined
  return {
    open: noop,
    sync: noop,
    rebuild: noop,
    changed: noop,
    deleted: noop,
    close: noop,
    linkSources
  } as unknown as IndexClient
}

let root: string
let vault: Vault
const events: [string, unknown[]][] = []
const file = (rel: string): string => readFileSync(path.join(root, rel), 'utf8')
const write = (rel: string, text: string): void => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  writeFileSync(path.join(root, rel), text)
}

beforeEach(async () => {
  const base = mkdtempSync(path.join(tmpdir(), 'write-vault-'))
  root = path.join(base, 'vault')
  mkdirSync(root)
  events.length = 0
  vault = new Vault(
    { id: 'test', name: 'Test', path: root },
    {
      dataDir: path.join(base, 'data'),
      index: fakeIndex(root),
      emit: (e, ...args) => void events.push([e, args]),
      snapshotDelayMs: () => 50,
      trashRetentionDays: () => 30
    }
  )
  await vault.open()
})

afterEach(async () => {
  await vault.close()
})

describe('Vault', () => {
  it('legt neue Seiten mit Frontmatter und freiem Namen an', async () => {
    const a = await vault.create('', 'Idee')
    const b = await vault.create('', 'Idee')
    expect(a).toBe('Idee.md')
    expect(b).toBe('Idee 2.md')
    const h = readHeader(a, file(a))
    expect(h.id).toMatch(/^[0-9A-Z]{26}$/)
    expect(h.title).toBe('Idee')
    const child = await vault.create(a, 'Unterseite')
    expect(child).toBe('Idee/Unterseite.md')
  })

  it('verweigert das Überschreiben extern geänderter Dateien', async () => {
    const rel = await vault.create('', 'Seite')
    const loaded = await vault.read(rel)
    write(rel, loaded.text + '\nvon einem anderen Mac\n')
    const res = await vault.write(rel, loaded.text + '\nlokal\n', loaded.hash)
    expect(res.ok).toBe(false)
    expect(file(rel)).toContain('von einem anderen Mac')
  })

  it('benennt Seite, Unterordner, Anhänge und alle Links in einem Schritt um', async () => {
    write('Alt.md', '---\nid: X\ntitle: Alt\n---\n![Bild](Alt/_assets/bild.png)\n')
    write('Alt/_assets/bild.png', 'png')
    write('Alt/Kind.md', 'Kind von [[Alt]]\n')
    write('Andere.md', 'Siehe [[Alt]], [[alt|klein]] und `[[Alt]]` im Code.\n')
    const next = await vault.rename('Alt.md', 'Neu')
    expect(next).toBe('Neu.md')
    expect(existsSync(path.join(root, 'Alt.md'))).toBe(false)
    expect(existsSync(path.join(root, 'Neu/_assets/bild.png'))).toBe(true)
    expect(file('Neu.md')).toContain('title: Neu')
    expect(file('Neu.md')).toContain('](Neu/_assets/bild.png)')
    expect(file('Andere.md')).toBe('Siehe [[Neu]], [[Neu|klein]] und `[[Alt]]` im Code.\n')
    expect(file('Neu/Kind.md')).toBe('Kind von [[Neu]]\n')
    const moved = events.find(([e]) => e === 'page:moved')![1][0] as { from: string; to: string }[]
    expect(moved).toContainEqual({ from: 'Alt/Kind.md', to: 'Neu/Kind.md' })
  })

  it('rollt das Umbenennen bei Namenskonflikt nicht an', async () => {
    write('A.md', 'a\n')
    write('B.md', 'b\n')
    await expect(vault.rename('A.md', 'B')).rejects.toThrow('error.nameTaken')
    expect(file('A.md')).toBe('a\n')
  })

  it('verschiebt Seiten samt Unterseiten und verhindert Zyklen', async () => {
    write('Ziel.md', 'z\n')
    write('Seite.md', 's\n')
    write('Seite/Kind.md', 'k\n')
    expect(await vault.move('Seite.md', 'Ziel.md')).toBe('Ziel/Seite.md')
    expect(file('Ziel/Seite/Kind.md')).toBe('k\n')
    await expect(vault.move('Ziel.md', 'Ziel/Seite.md')).rejects.toThrow('error.moveIntoSelf')
  })

  it('legt Ordner an und benennt sie samt Inhalt um', async () => {
    expect(await vault.create('', 'Projekte')).toBe('Projekte.md')
    // Must not collide with the child folder of the page „Projekte“
    expect(await vault.createFolder('', 'Projekte')).toBe('Projekte 2')
    const dir = await vault.createFolder('', 'Archiv')
    expect(dir).toBe('Archiv')
    expect(await vault.createFolder(dir, 'Alt')).toBe('Archiv/Alt')
    const page = await vault.create('Archiv/Alt', 'Notiz')
    expect(page).toBe('Archiv/Alt/Notiz.md')
    expect((await vault.tree()).find((n) => n.id === 'Archiv')?.kind).toBe('folder')
    expect(await vault.renameFolder('Archiv', '2025')).toBe('2025')
    expect(file('2025/Alt/Notiz.md')).toContain('title: Notiz')
    await expect(vault.renameFolder('Projekte', 'X')).rejects.toThrow('error.notAFolder')
  })

  it('legt Seiten samt Unterseiten in den Papierkorb und stellt sie wieder her', async () => {
    write('Weg.md', '---\ntitle: Weg\n---\nInhalt\n')
    write('Weg/Kind.md', 'k\n')
    await vault.trashPage('Weg.md')
    expect(existsSync(path.join(root, 'Weg.md'))).toBe(false)
    const [entry] = await vault.trash.list()
    expect(entry!.title).toBe('Weg')
    expect(entry!.originalPath).toBe('Weg.md')
    const restored = await vault.restoreFromTrash(entry!.id)
    expect(restored).toEqual({ path: 'Weg.md', kind: 'page' })
    expect(file('Weg/Kind.md')).toBe('k\n')
    expect(await vault.trash.list()).toEqual([])
  })

  it('legt Ordner samt Inhalt in den Papierkorb und stellt sie wieder her', async () => {
    write('Archiv/Alt.md', 'alt\n')
    write('Archiv/Tief/Noch.md', 'tief\n')
    const id = await vault.trashFolder('Archiv')
    expect(existsSync(path.join(root, 'Archiv'))).toBe(false)
    const [entry] = await vault.trash.list()
    expect(entry).toMatchObject({ id, title: 'Archiv', kind: 'folder' })
    const moved = events
      .filter(([e]) => e === 'page:moved')
      .flatMap(([, a]) => a[0] as { from: string }[])
    expect(moved.map((m) => m.from).sort()).toEqual(['Archiv/Alt.md', 'Archiv/Tief/Noch.md'])
    // Same name taken meanwhile → restored next to it
    write('Archiv/Neu.md', 'neu\n')
    expect(await vault.restoreFromTrash(id)).toEqual({ path: 'Archiv 2', kind: 'folder' })
    expect(file('Archiv 2/Tief/Noch.md')).toBe('tief\n')
    await expect(vault.trashFolder('Archiv/Neu')).rejects.toThrow()
  })

  it('erkennt Konfliktkopien und löst sie auf', async () => {
    write('Notiz.md', 'meins\n')
    write('Notiz (conflicted copy 2026-10-05 103045).md', 'deins\n')
    const tree = await vault.tree()
    expect(tree.map((n) => n.name)).toEqual(['Notiz'])
    expect(vault.getConflicts()).toEqual([
      { conflictPath: 'Notiz (conflicted copy 2026-10-05 103045).md', originalPath: 'Notiz.md' }
    ])
    await vault.resolveConflict('Notiz (conflicted copy 2026-10-05 103045).md', 'takeTheirs')
    expect(file('Notiz.md')).toBe('deins\n')
    expect(vault.getConflicts()).toEqual([])
  })

  it('hängt Quick-Capture-Einträge mit Uhrzeit an das heutige Journal', async () => {
    const rel = await vault.captureAppend('Erster Gedanke #idee')
    await vault.captureAppend('Zweiter\nmit zweiter Zeile')
    const text = file(rel)
    expect(rel).toMatch(/^Journal\/\d{4}-\d\d-\d\d\.md$/)
    expect(text).toMatch(
      /- \*\*\d\d:\d\d\*\* Erster Gedanke #idee\n- \*\*\d\d:\d\d\*\* Zweiter\n {2}mit zweiter Zeile\n$/
    )
  })

  it('füllt Platzhalter in Vorlagen', async () => {
    const [tpl] = await vault.templates()
    expect(tpl).toBeDefined()
    const md = await vault.renderTemplate(tpl!.path, 'Kickoff')
    expect(md).toContain('# Kickoff')
    expect(md).not.toContain('{{')
  })

  it('speichert Snapshots und stellt frühere Stände bereit', async () => {
    const rel = await vault.create('', 'Verlauf')
    const v1 = await vault.read(rel)
    await vault.write(rel, v1.text + 'Version 1\n', v1.hash)
    await vault.history.flush()
    const v2 = await vault.read(rel)
    await vault.write(rel, v2.text + 'Version 2\n', v2.hash)
    await vault.history.flush()
    const log = await vault.history.log(rel)
    expect(log.length).toBeGreaterThanOrEqual(2)
    const older = await vault.history.read(rel, log[1]!.oid)
    expect(older).toContain('Version 1')
    expect(older).not.toContain('Version 2')
  })
})
