import { describe, expect, it } from 'vitest'
import { extractTasks, parseTaskLine, updateTaskInText } from '@shared/tasks'

describe('Aufgaben', () => {
  it('liest Text, Status und Fälligkeit', () => {
    expect(parseTaskLine('- [ ] Angebot schicken 📅 2026-10-20')).toEqual({
      text: 'Angebot schicken',
      done: false,
      due: '2026-10-20'
    })
    expect(parseTaskLine('  * [x] Erledigt')).toEqual({ text: 'Erledigt', done: true, due: null })
    expect(parseTaskLine('1. [X] Nummeriert')).toMatchObject({ done: true })
    expect(parseTaskLine('- Kein To-do')).toBeNull()
    expect(parseTaskLine('[ ] ohne Aufzählung')).toBeNull()
  })

  it('findet To-dos mit Zeilennummer, aber nicht in Codeblöcken', () => {
    const raw = [
      '---',
      'title: T',
      '---',
      '- [ ] Eins',
      '```md',
      '- [ ] Im Code',
      '```',
      '~~~~',
      '```',
      '- [ ] Immer noch Code',
      '~~~~',
      '- [x] Zwei 📅 2026-01-02'
    ].join('\n')
    expect(extractTasks(raw)).toEqual([
      { line: 3, text: 'Eins', done: false, due: null },
      { line: 11, text: 'Zwei', done: true, due: '2026-01-02' }
    ])
  })

  it('ändert genau die Zeile und lässt alles andere stehen', () => {
    const raw = 'Intro\r\n  - [ ] Angebot 📅 2026-10-20\r\nEnde\r\n'
    expect(updateTaskInText(raw, 1, 'Angebot', { done: true })).toBe(
      'Intro\r\n  - [x] Angebot 📅 2026-10-20\r\nEnde\r\n'
    )
    expect(updateTaskInText(raw, 1, 'Angebot', { due: '2026-11-01' })).toBe(
      'Intro\r\n  - [ ] Angebot 📅 2026-11-01\r\nEnde\r\n'
    )
    expect(updateTaskInText(raw, 1, 'Angebot', { due: null, text: 'Angebot v2' })).toBe(
      'Intro\r\n  - [ ] Angebot v2\r\nEnde\r\n'
    )
    expect(updateTaskInText('- [X] A', 0, 'A', { done: true })).toBe('- [X] A')
    expect(updateTaskInText('- [x] A', 0, 'A', { done: false })).toBe('- [ ] A')
  })

  it('überschreibt nichts, wenn sich die Zeile inzwischen geändert hat', () => {
    expect(updateTaskInText('- [ ] Neu', 0, 'Alt', { done: true })).toBeNull()
    expect(updateTaskInText('Kein To-do', 0, 'Kein To-do', { done: true })).toBeNull()
    expect(updateTaskInText('- [ ] A', 5, 'A', { done: true })).toBeNull()
  })
})
