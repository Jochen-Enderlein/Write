import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PageFile, SearchHit, WriteResult } from '@shared/types'
import { tagsField } from '@shared/frontmatter'
import { readHeader } from '@shared/page'
import { invoke } from '../api'
import { journalDayOf } from '../lib/journal'
import { PageEditor, type PageEditorHandle } from '../editor/PageEditor'
import { MarkdownEditor } from '../editor/MarkdownEditor'
import { MarkdownPreview, type MarkdownPreviewHandle } from '../editor/MarkdownPreview'
import { useIpcEvent } from '../lib/hooks'
import { useStore, type EditorMode } from '../store'
import { WarningIcon } from './Icons'
import { IconPicker } from './IconPicker'
import { JournalBar } from './JournalBar'
import { Snippet } from './Snippet'
import { TagEditor } from './TagEditor'

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
  const [file, setFile] = useState<PageFile | null>(null)
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
  useLayoutEffect(() => {
    if (shown) document.querySelector('.main-scroll')?.scrollTo({ top: 0 })
  }, [shown])

  useIpcEvent('page:changed', (p) => {
    if (p !== shown) return
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
    setEditor({
      path: file.path,
      flush: async () => ed()?.flush(),
      insertMarkdown: (md) => ed()?.insertMarkdown(md),
      stats: () => ed()?.stats() ?? { words: 0 },
      headings: () => ed()?.headings() ?? [],
      scrollToBlock: (id) => ed()?.scrollToBlock(id),
      scrollToHeading: (text) => ed()?.scrollToHeading(text) ?? false,
      updateFrontmatter: (changes) => ed()?.updateFrontmatter(changes),
      exportHtml: () => ed()?.exportHtml() ?? '',
      findTarget: () => ed()?.findTarget() ?? null
    })
    // Coming from full-text search: show the hits on the page
    const query = useStore.getState().pendingFind
    if (query) useStore.getState().openFind(false)
    return () => setEditor(null)
  }, [file, setEditor])

  // Icon and tags live in the frontmatter; edits go through the editor so they save together
  const header = file ? readHeader(file.path, file.text) : null
  const [meta, setMeta] = useState<{ icon: string | null; tags: string[] }>({
    icon: null,
    tags: []
  })
  useEffect(() => {
    if (header) setMeta({ icon: header.icon, tags: tagsField(header.data) })
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
      <TagEditor tags={meta.tags} onChange={setTags} />
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
  const focusToken = useStore((s) => s.titleFocusToken)
  const committing = useRef(false)

  useEffect(() => setValue(title), [title])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  useEffect(() => {
    if (focusToken === 0 || !ref.current) return
    ref.current.focus()
    ref.current.select()
  }, [focusToken])

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
    if (newPath && newPath !== path) navigate({ kind: 'page', path: newPath }, { replace: true })
    else if (!newPath) setValue(title)
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
        <button key={h.path} className="backlink" onClick={() => openPage(h.path)}>
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
            <button className="mention-open" onClick={() => openPage(h.path)}>
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
