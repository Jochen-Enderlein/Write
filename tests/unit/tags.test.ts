import { describe, expect, it } from 'vitest'
import { isValidTag, renameTagInText, tagTree } from '@shared/tags'

describe('Tags', () => {
  it('benennt einen Tag samt Unter-Tags im Text und im Frontmatter um', () => {
    const page =
      '---\ntitle: Seite\ntags: [projekt, projekt/write, andere]\n---\n\nText #Projekt und #projekt/write/app, nicht #projekte.\n\n```\n#projekt bleibt im Code\n```\n\nAuch `#projekt` inline bleibt.\n'
    expect(renameTagInText(page, 'projekt', 'arbeit')).toBe(
      '---\ntitle: Seite\ntags:\n  - arbeit\n  - arbeit/write\n  - andere\n---\n\nText #arbeit und #arbeit/write/app, nicht #projekte.\n\n```\n#projekt bleibt im Code\n```\n\nAuch `#projekt` inline bleibt.\n'
    )
  })

  it('lässt Seiten ohne den Tag unverändert', () => {
    const page = '# Titel\n\nNur #anderes hier.\n'
    expect(renameTagInText(page, 'projekt', 'arbeit')).toBe(page)
  })

  it('prüft Tag-Namen', () => {
    expect(isValidTag('projekt/write')).toBe(true)
    expect(isValidTag('2026')).toBe(false)
    expect(isValidTag('a//b')).toBe(false)
    expect(isValidTag('mit leer')).toBe(false)
  })

  it('baut den Baum verschachtelter Tags', () => {
    const tree = tagTree([
      { tag: 'projekt/write', count: 3 },
      { tag: 'projekt', count: 1 },
      { tag: 'zettel', count: 2 },
      { tag: 'idee/neu/klein', count: 1 }
    ])
    expect(tree.map((n) => n.tag)).toEqual(['idee', 'projekt', 'zettel'])
    expect(tree[1]).toMatchObject({
      count: 1,
      children: [{ tag: 'projekt/write', name: 'write', count: 3 }]
    })
    expect(tree[0]!.children[0]!.children[0]!.tag).toBe('idee/neu/klein')
  })
})
