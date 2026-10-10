import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PageFile, SearchHit, WriteResult } from '@shared/types'
import { tagsField } from '@shared/frontmatter'
import { readHeader } from '@shared/page'
import { propertiesOf, type PropValue } from '@shared/properties'
import { invoke } from '../api'
import { journalDayOf } from '../lib/journal'
import { PageEditor, type PageEditorHandle } from '../editor/PageEditor'
import { MarkdownEditor } from '../editor/MarkdownEditor'
import { MarkdownPreview, type MarkdownPreviewHandle } from '../editor/MarkdownPreview'
import { useIpcEvent } from '../lib/hooks'
import { usePane, useSavedElsewhere } from '../lib/pane'
import { readPosition, writePosition } from '../lib/positions'
import { useStore, type EditorMode } from '../store'
import { WarningIcon } from './Icons'
import { IconPicker } from './IconPicker'
import { JournalBar } from './JournalBar'
import { Snippet } from './Snippet'
import { TagEditor } from './TagEditor'
import { AddPropertyButton, PropertyEditor } from './Properties'
import { Subpages } from './FolderView'

type Banner = null | { kind: 'external' } | { kind: 'conflict'; diskText: string }

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved'

export function PageView({
  path,
  onStatus
}: {
  path: string
  onStatus(s: SaveStatus): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const pane = usePane()
  const [file, setFile] = useState<PageFile | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [missing, setMissing] = useState(false)
  const [token, setToken] = useState(0)
  const [banner, setBanner] = useState<Banner>(null)
  const editorRef = useRef<PageEditorHandle>(null)
  const previewRef = useRef<MarkdownPreviewHandle>(null)
  const previewPane = useRef<HTMLDivElement>(null)
  const dirty = useRef(false)
  // The mode on screen follows the chosen one once the page is saved and read again
  const mode = useStore((s) => s.editorMode)
  const [shownMode, setShownMode] = useState<EditorMode>(mode)
  const [body, setBody] = useState('')
  const bodyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const setEditor = useStore((s) => s.setEditor)
  const setSheet = useStore((s) => s.setSheet)
  const notify = useStore((s) => s.notify)
  const fail = useStore((s) => s.fail)

  // The latest requested path; a slower read for a page we already left must not win
  const wanted = useRef(path)
  wanted.current = path

  const load = useCallback(
    async (nextMode?: EditorMode) => {
      try {
        const f = await invoke('page:read', path)
        if (wanted.current !== path) return
        if (nextMode) setShownMode(nextMode)
        setFile(f)
        setMissing(false)
        setToken((n) => n + 1)
        setBanner(null)
        dirty.current = false
      } catch {
        if (wanted.current !== path) return
        setFile(null)
        setMissing(true)
      }
    },
    [path]
  )

  // Keep showing the previous page until the next one is read, instead of flashing an empty
  // page on every switch
  useEffect(() => {
    void load()
  }, [load])

  // Switching modes: save what the current editor holds, then let the other one read the file
  useEffect(() => {
    if (mode === shownMode) return
    let stale = false
    void (async () => {
      await editorRef.current?.flush()
      if (!stale) await load(mode)
    })()
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const onBody = useCallback((text: string) => {
    clearTimeout(bodyTimer.current)
    bodyTimer.current = setTimeout(() => setBody(text), 120)
  }, [])
  useEffect(() => () => clearTimeout(bodyTimer.current), [])

  // In split view the preview follows the editor's scroll position
  const onScroll = useCallback((fraction: number) => {
    const el = previewPane.current
    if (el) el.scrollTop = fraction * (el.scrollHeight - el.clientHeight)
  }, [])

  // What is on screen; differs from `path` only while the next page is loading
  const shown = file?.path ?? null
  // A page opens where it was left; a new one, or one opened at a heading or a hit, at the top
  useLayoutEffect(() => {
    const el = pageRef.current?.closest<HTMLElement>('.pane-scroll')
    if (!shown || !el) return
    const st = useStore.getState()
    const top = st.pendingAnchor || st.pendingFind ? 0 : (readPosition(shown)?.scroll ?? 0)
    el.scrollTo({ top })
    // Images, diagrams and the editor itself may still grow the page for a moment
    let frame = 0
    let tries = 0
    const settle = (): void => {
      if (Math.abs(el.scrollTop - top) < 2 || ++tries > 20) return
      el.scrollTo({ top })
      frame = requestAnimationFrame(settle)
    }
    if (top > 0) frame = requestAnimationFrame(settle)
    const onScroll = (): void => writePosition(shown, { scroll: el.scrollTop })
    el.addEventListener('scroll', onScroll, { passive: true })
    // Scrolling by hand ends the settling, so it never pulls against the reader
    const stop = (): void => cancelAnimationFrame(frame)
    el.addEventListener('wheel', stop, { passive: true, once: true })
    return () => {
      stop()
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', stop)
    }
  }, [shown])

  useIpcEvent('page:changed', (p) => {
    if (p !== shown) return
    if (dirty.current) setBanner({ kind: 'external' })
    else void load()
  })
  // The same page in the other pane was saved
  useSavedElsewhere(shown, () => {
    if (dirty.current) setBanner({ kind: 'external' })
    else void load()
  })

  const status = useCallback(
    (s: SaveStatus) => {
      dirty.current = s === 'dirty' || s === 'saving'
      onStatus(s)
    },
    [onStatus]
  )

  const conflict = useCallback((r: Extract<WriteResult, { ok: false }>) => {
    setBanner({ kind: 'conflict', diskText: r.diskText })
  }, [])

  // Register with the store so menu commands (template insert, info …) reach this editor
  useEffect(() => {
    if (!file) return
    const ed = (): PageEditorHandle | null => editorRef.current
    setEditor(pane, {
      path: file.path,
      flush: async () => ed()?.flush(),
      insertMarkdown: (md) => ed()?.insertMarkdown(md),
      stats: () => ed()?.stats() ?? { words: 0 },
      headings: () => ed()?.headings() ?? [],
      scrollToBlock: (id) => ed()?.scrollToBlock(id),
      scrollToAnchor: (anchor) => ed()?.scrollToAnchor(anchor) ?? false,
      blockRef: () => ed()?.blockRef() ?? null,
      updateFrontmatter: (changes) => ed()?.updateFrontmatter(changes),
      exportHtml: () => ed()?.exportHtml() ?? '',
      findTarget: () => ed()?.findTarget() ?? null,
      selectionMarkdown: () => ed()?.selectionMarkdown() ?? null,
      bodyMarkdown: () => ed()?.bodyMarkdown() ?? ''
    })
    // Coming from full-text search: show the hits on the page
    const st = useStore.getState()
    if (st.pendingFind && st.activePane === pane) st.openFind(false)
    return () => setEditor(pane, null)
  }, [file, setEditor, pane])

  // Icon and tags live in the frontmatter; edits go through the editor so they save together
  const header = file ? readHeader(file.path, file.text) : null
  const [meta, setMeta] = useState<{
    icon: string | null
    tags: string[]
    props: Record<string, PropValue>
  }>({ icon: null, tags: [], props: {} })
  useEffect(() => {
    if (header)
      setMeta({ icon: header.icon, tags: tagsField(header.data), props: propertiesOf(header.data) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])
  const setIcon = (icon: string | null): void => {
    setMeta((m) => ({ ...m, icon }))
    editorRef.current?.updateFrontmatter({ icon: icon ?? undefined })
  }
  const setTags = (tags: string[]): void => {
    setMeta((m) => ({ ...m, tags }))
    editorRef.current?.updateFrontmatter({ tags: tags.length ? tags : undefined })
  }

  const [addingProp, setAddingProp] = useState(false)
  useEffect(() => setAddingProp(false), [path])
  const setProps = (changes: Record<string, PropValue | undefined>): void => {
    setMeta((m) => {
      const props = { ...m.props }
      for (const [k, v] of Object.entries(changes)) {
        if (v === undefined) delete props[k]
        else props[k] = v
      }
      return { ...m, props }
    })
    editorRef.current?.updateFrontmatter(changes)
  }

  const exportHtml = (): string =>
    previewRef.current?.exportHtml(header?.title ?? '', meta.icon) ?? ''

  if (missing) return <div className="center-message">{t('page.notFound')}</div>
  if (!file || !header) return <div className="page" aria-busy="true" />
  const journalDay = journalDayOf(file.path)

  const compare = async (): Promise<void> => {
    const disk = await invoke('page:read', file.path)
    setSheet({
      kind: 'compare',
      path: file.path,
      mine: editorRef.current?.currentText() ?? '',
      theirs: disk.text
    })
  }

  // Overwrites what arrived from outside (e.g. via sync), so it can be taken back right away
  const keepMine = async (): Promise<void> => {
    if (!banner) return
    const target = file.path
    try {
      const theirs =
        banner.kind === 'conflict' ? banner.diskText : (await invoke('page:read', target)).text
      setBanner(null)
      await editorRef.current?.forceSave()
      notify(t('page.keptMine'), {
        label: t('trash.undo'),
        run: () =>
          void invoke('page:write', target, theirs, null).then(() => {
            if (wanted.current === target) void load()
          }, fail)
      })
    } catch (err) {
      fail(err)
    }
  }

  return (
    <div
      className={`page ${shownMode === 'rich' ? '' : `mode-${shownMode}`}`}
      key={token}
      ref={pageRef}
      aria-busy={shown !== path || undefined}
    >
      {banner && (
        <div className="banner" role="alert">
          <WarningIcon />
          <span className="text">
            {banner.kind === 'external' ? t('page.externalChange') : t('page.saveConflict')}
          </span>
          <button className="button" onClick={() => void load()}>
            {t('page.reload')}
          </button>
          <button className="button" onClick={() => void keepMine()}>
            {t('page.keepMine')}
          </button>
          {/* The safe choice leads: look first, then decide */}
          <button className="button primary" onClick={() => void compare()}>
            {t('page.compare')}
          </button>
        </div>
      )}
      {journalDay && <JournalBar day={journalDay} />}
      <IconPicker icon={meta.icon} onChange={setIcon} />
      <TitleField
        path={file.path}
        title={header.title}
        onEnter={() => editorRef.current?.focusStart()}
      />
      <TagEditor
        tags={meta.tags}
        onChange={setTags}
        after={
          Object.keys(meta.props).length === 0 &&
          !addingProp && <AddPropertyButton onClick={() => setAddingProp(true)} />
        }
      />
      <PropertyEditor
        path={file.path}
        props={meta.props}
        adding={addingProp}
        setAdding={setAddingProp}
        onChange={setProps}
      />
      {shownMode === 'rich' ? (
        <PageEditor ref={editorRef} file={file} onStatus={status} onConflict={conflict} />
      ) : (
        <div className={shownMode === 'split' ? 'split-panes' : 'markdown-pane'}>
          <div className="split-source">
            <MarkdownEditor
              ref={editorRef}
              file={file}
              onStatus={status}
              onConflict={conflict}
              onBody={onBody}
              onScroll={shownMode === 'split' ? onScroll : undefined}
              exportHtml={exportHtml}
            />
          </div>
          {/* Hidden in Markdown mode; it still renders the page for export and printing */}
          <div
            className="split-preview"
            ref={previewPane}
            hidden={shownMode !== 'split'}
            aria-label={t('page.preview')}
          >
            <MarkdownPreview ref={previewRef} path={file.path} body={body} />
          </div>
        </div>
      )}
      <Subpages path={file.path} />
      <Backlinks path={file.path} title={header.title} />
    </div>
  )
}

function TitleField({
  path,
  title,
  onEnter
}: {
  path: string
  title: string
  onEnter(): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [value, setValue] = useState(title)
  const ref = useRef<HTMLTextAreaElement>(null)
  const renamePage = useStore((s) => s.renamePage)
  const navigate = useStore((s) => s.navigate)
  const openSide = useStore((s) => s.openSide)
  const focusToken = useStore((s) => s.titleFocusToken)
  const pane = usePane()
  const committing = useRef(false)

  useEffect(() => setValue(title), [title])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  useEffect(() => {
    // Only the title of the pane the command was meant for
    if (focusToken === 0 || !ref.current || useStore.getState().activePane !== pane) return
    ref.current.focus()
    ref.current.select()
  }, [focusToken, pane])

  const commit = async (): Promise<void> => {
    const next = value.replace(/\s+/g, ' ').trim()
    if (committing.current) return
    if (!next) {
      // A page needs a name (it is the file name); say so instead of silently reverting
      setValue(title)
      useStore.getState().notify(t('page.titleRequired'))
      return
    }
    if (next === title) return
    committing.current = true
    const newPath = await renamePage(path, next)
    committing.current = false
    if (newPath && newPath !== path) {
      if (pane === 'side') openSide(newPath)
      else navigate({ kind: 'page', path: newPath }, { replace: true })
    } else if (!newPath) setValue(title)
  }

  return (
    <textarea
      ref={ref}
      className="page-title"
      rows={1}
      value={value}
      placeholder={t('page.titlePlaceholder')}
      spellCheck={false}
      aria-label={t('page.titlePlaceholder')}
      onChange={(e) => setValue(e.target.value.replace(/\n/g, ''))}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (
          e.key === 'Enter' ||
          (e.key === 'ArrowDown' && e.currentTarget.selectionStart === value.length)
        ) {
          e.preventDefault()
          if (!value.trim()) {
            // Stay in the field and shake, like a macOS text field refusing its input
            const el = e.currentTarget
            el.classList.remove('shake')
            void el.offsetWidth
            el.classList.add('shake')
            return
          }
          if (value.replace(/\s+/g, ' ').trim() !== title)
            useStore.setState({ pendingEditorFocus: true })
          void commit()
          onEnter()
        } else if (e.key === 'Escape') {
          setValue(title)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function Backlinks({ path, title }: { path: string; title: string }): React.JSX.Element | null {
  const { t } = useTranslation()
  const [hits, setHits] = useState<SearchHit[]>([])
  const [mentions, setMentions] = useState<SearchHit[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const openPage = useStore((s) => s.openPage)
  const notify = useStore((s) => s.notify)
  const fail = useStore((s) => s.fail)

  // ⌘-click opens the source in the other pane
  const pane = usePane()
  const open = (e: React.MouseEvent, source: string): void =>
    openPage(source, e.metaKey ? (pane === 'main' ? 'side' : 'main') : undefined)

  const load = useCallback(() => {
    void invoke('index:backlinks', path).then(setHits, () => setHits([]))
    void invoke('index:mentions', path).then(setMentions, () => setMentions([]))
  }, [path])
  useEffect(load, [load])
  useIpcEvent('index:updated', load)

  const link = async (source: string): Promise<void> => {
    try {
      const res = await invoke('page:linkMentions', source, title)
      setMentions((m) => m.filter((h) => h.path !== source))
      if (!res.count) return
      // Undo only if nobody changed the page since (the hash guards against overwriting)
      notify(t('page.linked', { count: res.count }), {
        label: t('trash.undo'),
        run: () =>
          void invoke('page:write', source, res.before, res.hash).then(() => undefined, fail)
      })
    } catch (err) {
      fail(err)
    }
  }

  if (!hits.length && !mentions.length) return null
  return (
    <section className="backlinks" aria-label={t('page.backlinks')}>
      {hits.length > 0 && (
        <h2>
          {t('page.backlinks')} · {hits.length}
        </h2>
      )}
      {hits.map((h) => (
        <button key={h.path} className="backlink" onClick={(e) => open(e, h.path)}>
          <div className="title">
            {h.icon ? `${h.icon} ` : ''}
            {h.title}
          </div>
          <div className="snippet">
            <Snippet text={h.snippet} />
          </div>
        </button>
      ))}
      {mentions.length > 0 && (
        <button
          className="mentions-toggle"
          aria-expanded={showMentions}
          onClick={() => setShowMentions((v) => !v)}
        >
          {showMentions
            ? `${t('page.mentions')} · ${mentions.length}`
            : t('page.mentionsShow', { count: mentions.length })}
        </button>
      )}
      {showMentions &&
        mentions.map((h) => (
          <div key={h.path} className="backlink mention">
            <button className="mention-open" onClick={(e) => open(e, h.path)}>
              <div className="title">
                {h.icon ? `${h.icon} ` : ''}
                {h.title}
              </div>
              <div className="snippet">
                <Snippet text={h.snippet} />
              </div>
            </button>
            <button className="button small" onClick={() => void link(h.path)}>
              {t('page.linkMention')}
            </button>
          </div>
        ))}
    </section>
  )
}
