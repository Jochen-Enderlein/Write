import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import {
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
  type Extension
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  type DecorationSet,
  keymap,
  placeholder as placeholderExt
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  autocompletion,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { tags as tag } from '@lezer/highlight'
import type { PageFile, WriteResult } from '@shared/types'
import { buildFrontmatter, splitFrontmatter, updateFrontmatter } from '@shared/frontmatter'
import { composePage, readHeader } from '@shared/page'
import { normalizeTitle } from '@shared/wikilinks'
import { blockIdOf, blockLine, newBlockId } from '@shared/blockrefs'
import { invoke } from '../api'
import { t } from '../i18n'
import { useStore, type HeadingInfo } from '../store'
import { announceSaved, usePane } from '../lib/pane'
import type { FindTarget, Match } from './find'
import type { PageEditorHandle } from './PageEditor'

const SAVE_DELAY = 500

interface Props {
  file: PageFile
  onStatus(s: 'idle' | 'dirty' | 'saving' | 'saved'): void
  onConflict(r: Extract<WriteResult, { ok: false }>): void
  /** The body as typed, for the live preview */
  onBody?(body: string): void
  /** Called when the editor scrolls, with the scrolled fraction (0–1) */
  onScroll?(fraction: number): void
  /** Rendered HTML of the page for export; the preview provides it */
  exportHtml(): string
}

/** Headings of a Markdown body, outside fenced code. Ids are `line:<number>` (1-based). */
export function markdownHeadings(body: string): HeadingInfo[] {
  const out: HeadingInfo[] = []
  let fence: string | null = null
  body.split('\n').forEach((line, i) => {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (f) {
      if (!fence) fence = f[1]![0]!
      else if (f[1]![0] === fence) fence = null
      return
    }
    if (fence) return
    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (h) out.push({ id: `line:${i + 1}`, level: h[1]!.length, text: h[2]! })
  })
  return out
}

/** Words in a Markdown body, without the syntax around them. */
export function countMarkdownWords(body: string): number {
  return (
    body
      .replace(/^\s*(```|~~~).*$/gm, '')
      .replace(/\]\([^)]*\)/g, ']')
      .match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0
  )
}

// ── Find and replace ─────────────────────────────────────────────────────────

const setFind = StateEffect.define<{ matches: Match[]; current: number }>()
const findField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects)
      if (e.is(setFind)) {
        const len = tr.state.doc.length
        deco = Decoration.set(
          e.value.matches
            .filter((m) => m.to <= len && m.from < m.to)
            .map((m, i) =>
              Decoration.mark({
                class: i === e.value.current ? 'cm-find cm-find-current' : 'cm-find'
              }).range(m.from, m.to)
            )
        )
      }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f)
})

function codeMirrorFind(view: EditorView): FindTarget {
  return {
    find(query, matchCase) {
      if (!query) return []
      const text = view.state.doc.toString()
      const hay = matchCase ? text : text.toLocaleLowerCase()
      const needle = matchCase ? query : query.toLocaleLowerCase()
      const out: Match[] = []
      for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length))
        out.push({ from: i, to: i + needle.length })
      return out
    },
    highlight: (matches, current) => view.dispatch({ effects: setFind.of({ matches, current }) }),
    clear: () => view.dispatch({ effects: setFind.of({ matches: [], current: 0 }) }),
    reveal: (m) => {
      if (m) view.dispatch({ effects: EditorView.scrollIntoView(m.from, { y: 'center' }) })
    },
    select: (m) => {
      if (!m) return
      view.dispatch({ selection: EditorSelection.single(m.from, m.to), scrollIntoView: true })
      view.focus()
    },
    replace: (m, text) => view.dispatch({ changes: { from: m.from, to: m.to, insert: text } }),
    replaceAll(matches, text) {
      if (!matches.length) return 0
      view.dispatch({ changes: matches.map((m) => ({ from: m.from, to: m.to, insert: text })) })
      return matches.length
    }
  }
}

// ── Completion: [[links]] and #tags, like the rich editor ────────────────────

function linkCompletions(self: string) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const m = ctx.matchBefore(/\[\[[^\]\n|#]*$/)
    if (!m) return null
    const query = normalizeTitle(m.text.slice(2))
    const after = ctx.state.sliceDoc(ctx.pos, ctx.pos + 2)
    const close = after === ']]' ? '' : ']]'
    const options: Completion[] = useStore
      .getState()
      .titles.filter((p) => p.path !== self && normalizeTitle(p.title).includes(query))
      .sort(
        (a, b) =>
          Number(!normalizeTitle(a.title).startsWith(query)) -
            Number(!normalizeTitle(b.title).startsWith(query)) || a.title.localeCompare(b.title)
      )
      .slice(0, 30)
      .map((p) => ({
        label: p.title,
        detail: p.path.includes('/') ? p.path.replace(/\/[^/]+$/, '') : undefined,
        apply: p.title + close,
        type: 'text'
      }))
    return { from: m.from + 2, options, filter: false }
  }
}

function tagCompletions(ctx: CompletionContext): CompletionResult | null {
  const m = ctx.matchBefore(/(?:^|[\s(,;])#[\p{L}\p{N}_\-/]*$/u)
  if (!m) return null
  const from = m.from + m.text.indexOf('#') + 1
  const query = ctx.state.sliceDoc(from, ctx.pos).toLowerCase()
  if (!query && !ctx.explicit) return null
  const options: Completion[] = useStore
    .getState()
    .tags.filter((tg) => tg.tag.startsWith(query))
    .slice(0, 30)
    .map((tg) => ({ label: tg.tag, detail: String(tg.count), type: 'keyword' }))
  return options.length ? { from, options, filter: false } : null
}

// ── Look ─────────────────────────────────────────────────────────────────────

/** Plain text with just enough colour to read the structure. */
const highlightStyle = HighlightStyle.define([
  { tag: tag.heading, fontWeight: '700', color: 'var(--label)' },
  { tag: tag.strong, fontWeight: '700' },
  { tag: tag.emphasis, fontStyle: 'italic' },
  { tag: tag.strikethrough, textDecoration: 'line-through' },
  { tag: [tag.link, tag.url], color: 'var(--accent)' },
  { tag: tag.monospace, color: 'var(--md-code, #c2410c)' },
  { tag: tag.quote, color: 'var(--label-2)' },
  { tag: [tag.processingInstruction, tag.meta, tag.contentSeparator], color: 'var(--label-3)' },
  { tag: tag.list, color: 'var(--label-2)' }
])

const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--label)', fontSize: '14px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.65',
    caretColor: 'var(--accent)',
    padding: '4px 0 40vh'
  },
  '.cm-scroller': { fontFamily: 'var(--font-mono)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection, rgba(10, 132, 255, 0.25)) !important'
  },
  '.cm-placeholder': { color: 'var(--label-3)' },
  '.cm-find': { backgroundColor: 'rgba(255, 204, 0, 0.35)', borderRadius: '2px' },
  '.cm-find-current': { backgroundColor: 'rgba(255, 149, 0, 0.75)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--editor-bg)',
    border: '0.5px solid var(--separator)',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
    overflow: 'hidden'
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    padding: '4px'
  },
  '.cm-tooltip-autocomplete > ul > li': { borderRadius: '5px', padding: '3px 8px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-text)'
  },
  '.cm-completionDetail': { marginLeft: '8px', opacity: 0.6, fontStyle: 'normal' }
})

// ── Component ────────────────────────────────────────────────────────────────

/**
 * The page as plain Markdown (CodeMirror). Saves the body exactly as typed; title, icon and tags
 * stay in the frontmatter, edited above the text like in the rich editor.
 */
export const MarkdownEditor = forwardRef<PageEditorHandle, Props>(function MarkdownEditor(
  { file, onStatus, onConflict, onBody, onScroll, exportHtml },
  ref
) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const path = file.path
  const pane = usePane()
  const initial = useRef(readHeader(path, file.text))
  // The editor is created once per file; links to the page itself aren't suggested
  const self = useRef(path)
  // Blank lines between frontmatter and text are kept as they are but not shown
  const lead = useRef(/^\n*/.exec(initial.current.body)![0])
  const startText = useRef(initial.current.body.slice(lead.current.length))
  const state = useRef({
    header: initial.current,
    hash: file.hash,
    lastBody: startText.current,
    timer: 0 as unknown as ReturnType<typeof setTimeout>,
    saving: Promise.resolve() as Promise<void>,
    dirty: false,
    headerDirty: false,
    conflict: false
  })
  // Latest callbacks for the CodeMirror listeners, which are set up once
  const callbacks = useRef({ onBody, onScroll, onStatus })
  callbacks.current = { onBody, onScroll, onStatus }

  const body = (): string => view.current?.state.doc.toString() ?? state.current.lastBody

  const save = useCallback(
    (force = false): Promise<void> => {
      const s = state.current
      const run = async (): Promise<void> => {
        if (s.conflict && !force) return
        const text = body()
        if (text === s.lastBody && !force && !s.headerDirty) {
          s.dirty = false
          onStatus('idle')
          return
        }
        const page = composePage(s.header, path, lead.current + text)
        onStatus('saving')
        const res = await invoke('page:write', path, page, force ? null : s.hash)
        if (res.ok) {
          announceSaved(path, pane)
          s.hash = res.hash
          s.lastBody = text
          s.header = readHeader(path, page)
          s.dirty = false
          s.headerDirty = false
          s.conflict = false
          onStatus('saved')
        } else {
          s.conflict = true
          onConflict(res)
        }
      }
      s.saving = s.saving.then(run, run)
      return s.saving
    },
    [path, pane, onStatus, onConflict]
  )
  const saveRef = useRef(save)
  saveRef.current = save

  const flush = useCallback(async () => {
    clearTimeout(state.current.timer)
    if (state.current.dirty) await save()
    else await state.current.saving
  }, [save])

  useEffect(() => {
    const changed = EditorView.updateListener.of((u) => {
      if (!u.docChanged) return
      const s = state.current
      s.dirty = true
      callbacks.current.onStatus('dirty')
      clearTimeout(s.timer)
      s.timer = setTimeout(() => void saveRef.current(), SAVE_DELAY)
      const text = u.state.doc.toString()
      callbacks.current.onBody?.(text)
      useStore.setState((st) => ({
        docVersion: st.docVersion + 1,
        // The toolbar counts the main pane's page
        wordCount: pane === 'main' ? countMarkdownWords(text) : st.wordCount
      }))
    })
    const scrolled = EditorView.domEventHandlers({
      scroll: (_e, v) => {
        const el = v.scrollDOM
        const max = el.scrollHeight - el.clientHeight
        callbacks.current.onScroll?.(max > 0 ? el.scrollTop / max : 0)
      }
    })
    const extensions: Extension[] = [
      history(),
      autocompletion({
        override: [linkCompletions(self.current), tagCompletions],
        icons: false
      }),
      keymap.of([...completionKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap]),
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(highlightStyle),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        spellcheck: 'true',
        'aria-label': t('page.markdownEditor')
      }),
      placeholderExt(t('page.markdownPlaceholder')),
      findField,
      theme,
      changed,
      scrolled
    ]
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({ doc: startText.current, extensions })
    })
    view.current = v
    callbacks.current.onBody?.(startText.current)
    if (pane === 'main') useStore.setState({ wordCount: countMarkdownWords(startText.current) })
    if (useStore.getState().pendingEditorFocus) {
      useStore.setState({ pendingEditorFocus: false })
      v.focus()
    }
    return () => {
      v.destroy()
      view.current = null
    }
    // Created once per file; the pane of an editor never changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onBeforeUnload = (): void => void flush()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      void flush()
    }
  }, [flush])

  const goToLine = useCallback((line: number) => {
    const v = view.current
    if (!v) return
    const l = v.state.doc.line(Math.min(Math.max(1, line), v.state.doc.lines))
    v.dispatch({
      selection: EditorSelection.cursor(l.from),
      effects: EditorView.scrollIntoView(l.from, { y: 'start', yMargin: 24 })
    })
    v.focus()
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      flush,
      forceSave: () => save(true),
      currentText: () => composePage(state.current.header, path, lead.current + body()),
      insertMarkdown: (md) => {
        const v = view.current
        if (!v) return
        v.dispatch(v.state.replaceSelection(md))
        v.focus()
      },
      focusStart: () => {
        const v = view.current
        if (!v) return
        v.dispatch({ selection: EditorSelection.cursor(0), scrollIntoView: true })
        v.focus()
      },
      stats: () => ({ words: countMarkdownWords(body()) }),
      headings: () => markdownHeadings(body()),
      scrollToBlock: (id) => {
        const m = /^line:(\d+)$/.exec(id)
        if (m) goToLine(Number(m[1]))
      },
      scrollToAnchor: (anchor) => {
        if (anchor.startsWith('^')) {
          const line = blockLine(body(), anchor.slice(1))
          if (line !== -1) goToLine(line + 1)
          return line !== -1
        }
        const want = normalizeTitle(anchor)
        const h = markdownHeadings(body()).find((x) => normalizeTitle(x.text) === want)
        if (h) goToLine(Number(h.id.slice(5)))
        return Boolean(h)
      },
      updateFrontmatter: (changes) => {
        const s = state.current
        const raw = s.header.raw || buildFrontmatter({})
        const nextRaw = updateFrontmatter(raw, changes)
        const { data } = splitFrontmatter(nextRaw)
        s.header = { ...readHeader(path, nextRaw), raw: nextRaw, data }
        s.headerDirty = true
        s.dirty = true
        clearTimeout(s.timer)
        void save()
      },
      exportHtml,
      selectionMarkdown: () => {
        const v = view.current
        if (!v) return null
        const text = v.state.selection.ranges
          .filter((r) => !r.empty)
          .map((r) => v.state.sliceDoc(r.from, r.to))
          .join('\n\n')
        return text.trim() ? text : null
      },
      blockRef: () => {
        // The caret's line gets ` ^id` at its end, unless it already has one
        const v = view.current
        if (!v) return null
        const line = v.state.doc.lineAt(v.state.selection.main.head)
        const own = blockIdOf(line.text)
        if (own || !line.text.trim()) return own
        const id = newBlockId()
        v.dispatch({ changes: { from: line.to, insert: ` ^${id}` } })
        return id
      },
      bodyMarkdown: () => body(),
      findTarget: () => (view.current ? codeMirrorFind(view.current) : null)
    }),
    [flush, save, path, goToLine, exportHtml]
  )

  return <div className="markdown-editor" ref={host} />
})
