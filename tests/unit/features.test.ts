import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import git from 'isomorphic-git'
import fs from 'node:fs'
import { History } from '../../src/main/history'
import { Vault } from '../../src/main/vault'
import type { IndexClient } from '../../src/main/indexClient'
import { IndexDb } from '../../src/indexer/db'
import { extractPage } from '../../src/indexer/extract'
import { markdownToBlocks } from '@shared/markdown'
import { readHeader } from '@shared/page'
import {
  extractWikilinks,
  linkLabel,
  normalizeTitle,
  parseLinkTarget,
  rewriteWikilinks
} from '@shared/wikilinks'
import { adjacentDay, journalDayOf, journalDays } from '../../src/renderer/src/lib/journal'
import { resolveLanguage } from '@shared/i18n'

describe('Wiki-Links im Obsidian-Format', () => {
  it('trennt Seite, Pfad und Überschrift', () => {
    expect(parseLinkTarget('Projekt#Ziele')).toEqual({
      page: 'Projekt',
      heading: 'Ziele',
      block: null
    })
    expect(parseLinkTarget('Ordner/Seite.md')).toEqual({
      page: 'Ordner/Seite',
      heading: null,
      block: null
    })
    expect(parseLinkTarget('#Notizen')).toEqual({ page: '', heading: 'Notizen', block: null })
    expect(parseLinkTarget('Seite#^block1')).toEqual({
      page: 'Seite',
      heading: null,
      block: 'block1'
    })
    expect(linkLabel('Projekt#Ziele')).toBe('Projekt › Ziele')
    expect(linkLabel('#Notizen')).toBe('Notizen')
    expect(linkLabel('Seite#^block1')).toBe('Seite › ^block1')
  })

  it('indexiert nur den Seitenteil und keine Bilder', () => {
    const links = extractWikilinks('[[A#x]] [[Ordner/B]] ![[bild.png]] ![[C#y]] [[#lokal]]')
    expect(links).toEqual(['A', 'Ordner/B', 'C'])
  })

  it('behält Abschnitt, Alias und Ordner beim Umbenennen', () => {
    const text = '[[Alt#Ziele]] [[Ordner/Alt|x]] ![[Alt]] [[Altbau]]'
    expect(rewriteWikilinks(text, 'Alt', 'Neu')).toBe(
      '[[Neu#Ziele]] [[Ordner/Neu|x]] ![[Neu]] [[Altbau]]'
    )
  })

  it('erkennt Einbettungen beim Parsen', () => {
    const [p] = markdownToBlocks('Text ![[bild.png|300]] und [[A#B]]', () => 'id')
    const content = p!.content as { type: string; props?: Record<string, unknown> }[]
    expect(content.filter((c) => c.type === 'wikilink').map((c) => c.props)).toEqual([
      { target: 'bild.png', alias: '300', embed: true },
      { target: 'A#B', alias: '' }
    ])
    expect(content[0]).toMatchObject({ type: 'text', text: 'Text ' })
  })
})

describe('Index: Pfade, Abschnitte und Erwähnungen', () => {
  const stamp = { mtimeMs: 1, size: 1 }
  const db = (): IndexDb =>
    new IndexDb(path.join(mkdtempSync(path.join(tmpdir(), 'write-idx-')), 'index.sqlite'))

  it('löst Abschnitts- und Pfad-Links auf', () => {
    const d = db()
    d.upsert('Projekt.md', stamp, extractPage('Projekt.md', '# Ziele'))
    d.upsert('A/Seite.md', stamp, extractPage('A/Seite.md', 'x'))
    d.upsert('B/Seite.md', stamp, extractPage('B/Seite.md', 'y'))
    expect(d.resolve('Projekt#Ziele')).toBe('Projekt.md')
    expect(d.resolve('B/Seite')).toBe('B/Seite.md')
    expect(d.resolve('b/seite.md')).toBe('B/Seite.md')
    expect(d.resolve('#nur-abschnitt')).toBeNull()
  })

  it('zählt Pfad- und Abschnitts-Links als Rückverweise', () => {
    const d = db()
    d.upsert('B/Seite.md', stamp, extractPage('B/Seite.md', 'y'))
    d.upsert('X.md', stamp, extractPage('X.md', '[[B/Seite]]'))
    d.upsert('Y.md', stamp, extractPage('Y.md', '[[Seite#Teil]]'))
    d.upsert('Z.md', stamp, extractPage('Z.md', '[[A/Seite]]'))
    expect(
      d
        .backlinks('B/Seite.md')
        .map((h) => h.path)
        .sort()
    ).toEqual(['X.md', 'Y.md'])
    expect(d.linkSources(['Seite']).sort()).toEqual(['X.md', 'Y.md', 'Z.md'])
  })

  it('findet nicht verlinkte Erwähnungen', () => {
    const d = db()
    d.upsert('Kaffee.md', stamp, extractPage('Kaffee.md', 'Bohnen'))
    d.upsert('A.md', stamp, extractPage('A.md', 'Heute Kaffee getrunken.'))
    d.upsert('B.md', stamp, extractPage('B.md', 'Schon verlinkt: [[Kaffee]].'))
    d.upsert('C.md', stamp, extractPage('C.md', 'Tee.'))
    expect(d.mentions('Kaffee.md').map((h) => h.path)).toEqual(['A.md'])
  })
})

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
            wanted.has(normalizeTitle(l.replace(/^.*\//, '')))
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

describe('Vault: Journal, Reihenfolge, Ordner, Erwähnungen, Einbettungen', () => {
  let root: string
  let vault: Vault
  const file = (rel: string): string => readFileSync(path.join(root, rel), 'utf8')
  const write = (rel: string, text: string): void => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    writeFileSync(path.join(root, rel), text)
  }
  const names = (nodes: { name: string }[]): string[] => nodes.map((n) => n.name)

  beforeEach(async () => {
    const base = mkdtempSync(path.join(tmpdir(), 'write-vault-'))
    root = path.join(base, 'vault')
    mkdirSync(root)
    vault = new Vault(
      { id: 'test', name: 'Test', path: root },
      {
        dataDir: path.join(base, 'data'),
        index: fakeIndex(root),
        emit: () => undefined,
        snapshotDelayMs: () => 50,
        trashRetentionDays: () => 30
      }
    )
    await vault.open()
  })

  afterEach(async () => {
    await vault.close()
  })

  it('legt Journalseiten ohne doppelte Überschrift an', async () => {
    const rel = await vault.journalDay('2026-10-04')
    expect(rel).toBe('Journal/2026-10-04.md')
    const h = readHeader(rel, file(rel))
    expect(h.title).toBe('2026-10-04')
    expect(h.body.trim()).toBe('')
    await expect(vault.journalDay('morgen')).rejects.toThrow()
  })

  it('merkt sich die manuelle Reihenfolge, auch nach Umbenennen', async () => {
    write('A.md', 'a')
    write('B.md', 'b')
    write('C.md', 'c')
    expect(names(await vault.tree())).toEqual(['A', 'B', 'C'])
    await vault.setOrder('', ['C.md', 'A.md'])
    expect(names(await vault.tree())).toEqual(['C', 'A', 'B'])
    await vault.rename('C.md', 'Zett')
    expect(names(await vault.tree())).toEqual(['Zett', 'A', 'B'])
    const cfg = JSON.parse(file('.docuapp/vault.json'))
    expect(cfg.order['']).toEqual(['Zett.md', 'A.md'])
  })

  it('verschiebt Ordner mit Inhalt', async () => {
    write('Alt/Seite.md', 'x')
    write('Ziel/Anderes.md', 'y')
    const next = await vault.moveFolder('Alt', 'Ziel')
    expect(next).toBe('Ziel/Alt')
    expect(existsSync(path.join(root, 'Ziel/Alt/Seite.md'))).toBe(true)
    expect(existsSync(path.join(root, 'Alt'))).toBe(false)
    await expect(vault.moveFolder('Ziel', 'Ziel/Alt')).rejects.toThrow('error.moveIntoSelf')
  })

  it('verlinkt Erwähnungen, aber nicht in Code, Links oder Wörtern', async () => {
    write(
      'Notiz.md',
      '---\ntitle: Kaffee am Morgen\n---\nKaffee ist gut. kaffee auch. Kaffeebohne nicht.\n[[Kaffee]] schon, [Kaffee](x) auch, `Kaffee` im Code.\n'
    )
    const before = file('Notiz.md')
    const res = await vault.linkMentions('Notiz.md', 'Kaffee')
    expect(res.count).toBe(2)
    expect(res.before).toBe(before)
    expect(readHeader('Notiz.md', file('Notiz.md')).body).toBe(
      '[[Kaffee]] ist gut. [[Kaffee|kaffee]] auch. Kaffeebohne nicht.\n[[Kaffee]] schon, [Kaffee](x) auch, `Kaffee` im Code.\n'
    )
    expect(file('Notiz.md')).toContain('title: Kaffee am Morgen')
  })

  it('findet eingebettete Bilder neben der Seite oder irgendwo im Vault', async () => {
    write('Seite.md', '![[bild.png]]')
    write('Seite/_assets/bild.png', 'png')
    write('Medien/tief/foto.jpg', 'jpg')
    expect(await vault.resolveEmbed('Seite.md', 'bild.png')).toBe('Seite/_assets/bild.png')
    expect(await vault.resolveEmbed('Seite.md', 'foto.jpg')).toBe('Medien/tief/foto.jpg')
    expect(await vault.resolveEmbed('Seite.md', 'fehlt.png')).toBeNull()
    expect(await vault.resolveEmbed('Seite.md', 'Seite')).toBeNull()
  })
})

describe('Snapshot-Historie aufräumen', () => {
  it('entfernt alte Snapshots und behält die neueren lesbar', async () => {
    const base = mkdtempSync(path.join(tmpdir(), 'write-hist-'))
    const dir = path.join(base, 'vault')
    const gitdir = path.join(base, 'git')
    mkdirSync(dir)
    const h = new History(dir, gitdir, () => 10)
    const realNow = Date.now
    try {
      for (const [i, daysAgo] of [400, 200, 10, 1].entries()) {
        Date.now = () => realNow() - daysAgo * 86400_000
        writeFileSync(path.join(dir, 'a.md'), `Version ${i}` + '!'.repeat(i))
        await h.snapshot(['a.md'], `v${i}`)
      }
    } finally {
      Date.now = realNow
    }
    expect(await h.log('a.md')).toHaveLength(4)
    await h.prune(30)
    const log = await h.log('a.md')
    expect(log.map((e) => e.message)).toEqual(['v3', 'v2'])
    expect(await h.read('a.md', log[1]!.oid)).toBe('Version 2!!')
    // Objects of dropped snapshots are gone
    const all = await git.log({ fs, dir, gitdir })
    expect(all).toHaveLength(2)

    // Everything older than the newest snapshot: the newest one stays
    await h.prune(0.0001)
    expect((await h.log('a.md')).map((e) => e.message)).toEqual(['v3'])
  })
})

describe('Journal-Navigation und Sprache', () => {
  it('springt zum vorherigen und nächsten vorhandenen Eintrag', () => {
    const titles = [
      'Journal/2026-10-01.md',
      'Journal/2026-10-05.md',
      'Notiz.md',
      'Journal/x.md'
    ].map((p) => ({ path: p, id: null, title: p, icon: null, tags: [] }))
    const days = journalDays(titles)
    expect(days).toEqual(['2026-10-01', '2026-10-05'])
    expect(adjacentDay(days, '2026-10-05', -1)).toBe('2026-10-01')
    expect(adjacentDay(days, '2026-10-03', 1)).toBe('2026-10-05')
    expect(adjacentDay(days, '2026-10-05', 1)).toBeNull()
    expect(journalDayOf('Journal/2026-10-05.md')).toBe('2026-10-05')
    expect(journalDayOf('Projekte/2026-10-05.md')).toBeNull()
  })

  it('wählt die Sprache aus Einstellung und System', () => {
    expect(resolveLanguage('system', 'de-AT')).toBe('de')
    expect(resolveLanguage('system', 'fr-FR')).toBe('en')
    expect(resolveLanguage('de', 'en-US')).toBe('de')
    expect(resolveLanguage(undefined, 'en-GB')).toBe('en')
  })
})
