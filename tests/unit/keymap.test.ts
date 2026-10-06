import { describe, expect, it } from 'vitest'
import { COMMANDS, EDITOR_SHORTCUTS, acceleratorGlyphs } from '@shared/keymap'

const norm = (acc: string): string =>
  acc
    .split('+')
    .map((p) => p.toLowerCase())
    .sort()
    .join('+')

/** Shortcuts macOS, the Edit menu and text editing already own. */
const RESERVED = [
  'CmdOrCtrl+Q',
  'CmdOrCtrl+W',
  'CmdOrCtrl+H',
  'CmdOrCtrl+Alt+H',
  'CmdOrCtrl+M',
  'CmdOrCtrl+Z',
  'CmdOrCtrl+Shift+Z',
  'CmdOrCtrl+X',
  'CmdOrCtrl+C',
  'CmdOrCtrl+V',
  'CmdOrCtrl+Shift+V',
  'CmdOrCtrl+Alt+Shift+V',
  'CmdOrCtrl+A',
  'CmdOrCtrl+Backspace',
  'CmdOrCtrl+Y',
  'CmdOrCtrl+0',
  'CmdOrCtrl+Plus',
  'CmdOrCtrl+-',
  'CmdOrCtrl+Control+F'
]

describe('Keymap', () => {
  const app = COMMANDS.filter((c) => c.accelerator).map((c) => ({
    id: c.id,
    acc: norm(c.accelerator!)
  }))

  it('belegt keinen Kurzbefehl doppelt', () => {
    const seen = new Map<string, string>()
    for (const { id, acc } of app) {
      expect(seen.get(acc), `${id} kollidiert mit ${seen.get(acc)}`).toBeUndefined()
      seen.set(acc, id)
    }
  })

  it('überschreibt weder Editor- noch macOS-Kurzbefehle', () => {
    const taken = new Set([...EDITOR_SHORTCUTS.map((e) => e.keys), ...RESERVED].map(norm))
    for (const { id, acc } of app)
      expect(taken.has(acc), `${id} (${acc}) ist schon belegt`).toBe(false)
  })

  it('zeigt Kurzbefehle mit Mac-Symbolen in fester Reihenfolge', () => {
    expect(acceleratorGlyphs('CmdOrCtrl+Shift+F')).toBe('⇧⌘F')
    expect(acceleratorGlyphs('Control+Alt+Space')).toBe('⌃⌥ Leertaste')
    expect(acceleratorGlyphs('CmdOrCtrl+Alt+Backspace')).toBe('⌥⌘⌫')
    expect(acceleratorGlyphs('Control+CmdOrCtrl+S')).toBe('⌃⌘S')
  })
})
