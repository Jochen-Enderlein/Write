import { createExtension, type BlockNoteEditor } from '@blocknote/core'

/**
 * Editor-style indentation for code: Enter keeps the line's indentation (one level more after
 * an opening bracket or colon), Tab and Shift-Tab indent and outdent the selected lines. The
 * helpers work on plain text offsets so the Mermaid source field and code blocks share them.
 */
export const INDENT = '  '

/** What Enter inserts after `before` (the text up to the cursor). */
export function newlineWithIndent(before: string): string {
  const line = before.slice(before.lastIndexOf('\n') + 1)
  const indent = /^[ \t]*/.exec(line)![0]
  return '\n' + indent + (/[{[(:]\s*$/.test(line) ? INDENT : '')
}

/** Offsets where the lines touched by [from, to] start, last line first. */
export function lineStarts(text: string, from: number, to: number): number[] {
  const starts = [text.lastIndexOf('\n', from - 1) + 1]
  for (let i = text.indexOf('\n', from); i !== -1 && i < to; i = text.indexOf('\n', i + 1))
    starts.push(i + 1)
  return starts.reverse()
}

/** How many characters Shift-Tab removes from the line starting at `start`. */
export function outdentWidth(text: string, start: number): number {
  if (text[start] === '\t') return 1
  let n = 0
  while (n < INDENT.length && text[start + n] === ' ') n++
  return n
}

export interface TextEdit {
  text: string
  start: number
  end: number
}

/** Applies a key to a plain text field; returns null for keys it leaves alone. */
export function editForKey(
  key: 'Enter' | 'Tab' | 'Shift-Tab',
  text: string,
  start: number,
  end: number
): TextEdit | null {
  if (key === 'Enter') {
    const ins = newlineWithIndent(text.slice(0, start))
    return {
      text: text.slice(0, start) + ins + text.slice(end),
      start: start + ins.length,
      end: start + ins.length
    }
  }
  const multiline = text.slice(start, end).includes('\n')
  if (key === 'Tab' && !multiline) {
    return {
      text: text.slice(0, start) + INDENT + text.slice(end),
      start: start + INDENT.length,
      end: start + INDENT.length
    }
  }
  let out = text
  let first = 0
  let total = 0
  for (const s of lineStarts(text, start, end)) {
    const delta = key === 'Tab' ? INDENT.length : -outdentWidth(out, s)
    out =
      key === 'Tab'
        ? out.slice(0, s) + INDENT + out.slice(s)
        : out.slice(0, s) + out.slice(s - delta)
    total += delta
    first = delta
  }
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  return {
    text: out,
    start: Math.max(lineStart, start + first),
    end: multiline || start !== end ? end + total : Math.max(lineStart, start + first)
  }
}

/** The same behaviour inside the editor's code blocks; runs before BlockNote's own keys. */
export const codeIndent = createExtension({
  key: 'write-code-indent',
  runsBefore: ['code-block-keyboard-shortcuts'],
  keyboardShortcuts: {
    Enter: ({ editor }) =>
      editor.transact((tr) => {
        const { $from, $to } = tr.selection
        if (!$from.parent.type.spec.code || !$from.sameParent($to)) return false
        const before = $from.parent.textContent.slice(0, $from.parentOffset)
        // Enter on an empty last line leaves the block – BlockNote handles that
        if ($from.parentOffset === $from.parent.content.size && before.endsWith('\n\n'))
          return false
        const line = before.slice(before.lastIndexOf('\n') + 1)
        if (line && !line.trim()) {
          // A line of only indentation: drop it instead of carrying it along
          tr.delete($from.pos - line.length, $to.pos)
          tr.insertText('\n')
          return true
        }
        tr.insertText(newlineWithIndent(before), $from.pos, $to.pos)
        return true
      }),
    Tab: ({ editor }) => shiftLines(editor, 'Tab'),
    'Shift-Tab': ({ editor }) => shiftLines(editor, 'Shift-Tab')
  }
})

function shiftLines(editor: BlockNoteEditor<any, any, any>, key: 'Tab' | 'Shift-Tab'): boolean {
  return editor.transact((tr) => {
    const { $from, $to } = tr.selection
    if (!$from.parent.type.spec.code || !$from.sameParent($to)) return false
    const text = $from.parent.textContent
    // A plain Tab without a multi-line selection: BlockNote inserts the spaces
    if (key === 'Tab' && !text.slice($from.parentOffset, $to.parentOffset).includes('\n'))
      return false
    const base = $from.start()
    for (const s of lineStarts(text, $from.parentOffset, $to.parentOffset)) {
      if (key === 'Tab') tr.insertText(INDENT, base + s)
      else {
        const w = outdentWidth(text, s)
        if (w) tr.delete(base + s, base + s + w)
      }
    }
    return true
  })
}
