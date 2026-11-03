// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mayRestoreFocus } from '@renderer/lib/positions'

const element = (html: string): Element => {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host.querySelector('[data-target]')!
}

describe('Fokus beim Öffnen einer Seite', () => {
  it('holt den Fokus zurück, wenn gerade nichts oder eine Seitenleisten-Zeile ihn hat', () => {
    expect(mayRestoreFocus(null)).toBe(true)
    expect(mayRestoreFocus(document.body)).toBe(true)
    expect(mayRestoreFocus(element('<div role="treeitem" data-target tabindex="0"></div>'))).toBe(
      true
    )
  })

  it('nimmt ihn keinem anderen Editor weg, in dem gerade geschrieben wird', () => {
    expect(mayRestoreFocus(element('<div contenteditable="true"><p data-target></p></div>'))).toBe(
      false
    )
  })

  it('nimmt ihn keinem Eingabefeld weg', () => {
    expect(mayRestoreFocus(element('<textarea data-target></textarea>'))).toBe(false)
    expect(mayRestoreFocus(element('<input data-target />'))).toBe(false)
  })
})
