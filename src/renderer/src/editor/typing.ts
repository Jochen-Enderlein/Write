import { createExtension } from '@blocknote/core'
import { Plugin, PluginKey, TextSelection, type EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

export type QuoteStyle = 'de' | 'en'

const QUOTES: Record<QuoteStyle, { open: string; close: string; open1: string; close1: string }> = {
  de: { open: '„', close: '“', open1: '‚', close1: '‘' },
  en: { open: '“', close: '”', open1: '‘', close1: '’' }
}

/** Before these (or at the start of a block) a quote opens; anywhere else it closes. */
const OPENS_AFTER = /^$|[\s([{–—/-]$/

export interface Replacement {
  /** How many characters before the caret the replacement starts. */
  back: number
  insert: string
}

/**
 * What typing `text` right after `before` (the block's text up to the caret) turns into:
 * `"` → „ or “, `'` after a letter → ’, ` -- ` → ` – `, `...` → `…`. Null leaves it alone.
 */
export function smartReplacement(
  before: string,
  text: string,
  style: QuoteStyle
): Replacement | null {
  const q = QUOTES[style]
  if (text === '"') return { back: 0, insert: OPENS_AFTER.test(before) ? q.open : q.close }
  if (text === "'") {
    // After a letter it is an apostrophe (geht’s, Jochen’s) or a closing quote, which in
    // English is the same character
    if (/[\p{L}\p{N}.,!?]$/u.test(before)) return { back: 0, insert: '’' }
    return OPENS_AFTER.test(before) ? { back: 0, insert: q.open1 } : null
  }
  // Only between spaces, so `---`, `--flag` and `<!--` stay as typed
  if (text === ' ' && /(^|\s)--$/.test(before)) return { back: 2, insert: '– ' }
  if (text === '.' && before.endsWith('..') && !before.endsWith('...'))
    return { back: 2, insert: '…' }
  return null
}

/** The characters typed over a selection that wrap it instead of replacing it. */
export function wrapPair(text: string, smart: boolean, style: QuoteStyle): [string, string] | null {
  const q = QUOTES[style]
  switch (text) {
    case '(':
      return ['(', ')']
    case '[':
      return ['[', ']']
    case '{':
      return ['{', '}']
    case '"':
      return smart ? [q.open, q.close] : ['"', '"']
    case "'":
      return smart ? [q.open1, q.close1] : ["'", "'"]
    case '„':
      return ['„', '“']
    case '“':
      return ['“', '”']
    default:
      return null
  }
}

interface Undo {
  from: number
  to: number
  original: string
}

const key = new PluginKey<Undo | null>('write-typing')

function inCode(state: EditorState, pos: number): boolean {
  const $pos = state.doc.resolve(pos)
  if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return true
  const code = state.schema.marks.code
  return Boolean(code && (state.storedMarks ?? $pos.marks()).some((m) => m.type === code))
}

function wrapSelection(
  view: EditorView,
  from: number,
  to: number,
  text: string,
  smart: boolean,
  style: QuoteStyle
): boolean {
  const { state } = view
  const $from = state.doc.resolve(from)
  if (!$from.sameParent(state.doc.resolve(to))) return false
  const selected = state.doc.textBetween(from, to)

  // `[` on a selection already wrapped in `[…]` makes it a `[[link]]`
  const link = state.schema.nodes.wikilink
  if (
    text === '[' &&
    link &&
    from > $from.start() &&
    state.doc.textBetween(from - 1, from) === '[' &&
    state.doc.textBetween(to, to + 1) === ']' &&
    selected.trim() &&
    !/[[\]|#^\n]/.test(selected)
  ) {
    const node = link.create({ target: selected.trim(), alias: '', embed: false })
    const tr = state.tr.replaceWith(from - 1, to + 1, node)
    tr.setSelection(TextSelection.create(tr.doc, from - 1 + node.nodeSize))
    view.dispatch(tr.scrollIntoView())
    return true
  }

  const pair = wrapPair(text, smart, style)
  if (!pair || !selected) return false
  const tr = state.tr.insertText(pair[1], to).insertText(pair[0], from)
  // The text stays selected, so a second `[` (or another pair) can follow
  tr.setSelection(TextSelection.create(tr.doc, from + pair[0].length, to + pair[0].length))
  view.dispatch(tr)
  return true
}

/**
 * Typing help in the rich editor: smart punctuation (`smart()` is read on every keystroke, so
 * the setting applies at once) and wrapping a selection in brackets or quotes. Code blocks and
 * inline code are left alone. Backspace right after a replacement restores what was typed.
 */
export function typing(smart: () => boolean, style: () => QuoteStyle) {
  return createExtension({
    key: 'write-typing',
    prosemirrorPlugins: [
      new Plugin<Undo | null>({
        key,
        state: {
          init: () => null,
          apply: (tr, prev) => {
            const meta = tr.getMeta(key) as Undo | null | undefined
            if (meta !== undefined) return meta
            if (!prev || tr.selectionSet) return null
            // Plugins that tidy up after a change (block ids …) do not end the chance to undo
            if (tr.getMeta('appendedTransaction'))
              return { ...prev, from: tr.mapping.map(prev.from), to: tr.mapping.map(prev.to) }
            return tr.docChanged ? null : prev
          }
        },
        props: {
          handleTextInput(view, from, to, text) {
            if (view.composing || inCode(view.state, from)) return false
            if (from !== to) return wrapSelection(view, from, to, text, smart(), style())
            if (!smart()) return false
            const $from = view.state.doc.resolve(from)
            const before = $from.parent.textBetween(
              Math.max(0, $from.parentOffset - 3),
              $from.parentOffset,
              undefined,
              '￼'
            )
            const rep = smartReplacement(before, text, style())
            if (!rep) return false
            const start = from - rep.back
            const original = view.state.doc.textBetween(start, from) + text
            const tr = view.state.tr.insertText(rep.insert, start, to)
            tr.setMeta(key, { from: start, to: start + rep.insert.length, original })
            view.dispatch(tr)
            return true
          },
          handleKeyDown(view, event) {
            if (event.key !== 'Backspace' || event.metaKey || event.altKey || event.ctrlKey)
              return false
            const undo = key.getState(view.state)
            const sel = view.state.selection
            if (!undo || !sel.empty || sel.from !== undo.to) return false
            const tr = view.state.tr.insertText(undo.original, undo.from, undo.to)
            tr.setMeta(key, null)
            view.dispatch(tr)
            return true
          }
        }
      })
    ]
  })
}
