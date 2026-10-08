import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FolderLayout, PageSummary, TreeNode } from '@shared/types'
import { childFolderOf } from '@shared/paths'
import { invoke } from '../api'
import { relativeTime, useIpcEvent } from '../lib/hooks'
import { useStore } from '../store'
import { DocIcon, FolderIcon, FolderPlusIcon, PlusIcon } from './Icons'
import { TableView } from './TableView'

/** The folder's node in the tree, searched depth-first. */
function findFolder(nodes: TreeNode[], folder: string): TreeNode | null {
  for (const n of nodes) {
    if (n.kind === 'folder' && n.folder === folder) return n
    const hit = n.children ? findFolder(n.children, folder) : null
    if (hit) return hit
  }
  return null
}

/** A page's node in the tree, searched depth-first. */
function findPage(nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n
    const hit = n.children ? findPage(n.children, path) : null
    if (hit) return hit
  }
  return null
}

/** Everything below a node, for the "n items" line on nested folders and pages. */
function countItems(n: TreeNode): number {
  return (n.children ?? []).reduce((sum, c) => sum + 1 + countItems(c), 0)
}

/** Index text starts with the heading; a preview shouldn't repeat the title. */
function preview(s: PageSummary | undefined, title: string): string {
  if (!s) return ''
  let text = s.snippet.replace(/\s+/g, ' ').trim()
  if (text.toLowerCase().startsWith(title.toLowerCase())) text = text.slice(title.length).trim()
  return text
}

/** Cards or table for one folder, synced in vault.json; the default (cards) is not stored. */
function useFolderLayout(folder: string): [FolderLayout, (next: FolderLayout) => void] {
  const fail = useStore((s) => s.fail)
  const [layout, setLayout] = useState<FolderLayout>({ mode: 'cards', table: {} })
  useEffect(() => {
    let live = true
    setLayout({ mode: 'cards', table: {} })
    void invoke('folder:layout', folder).then(
      (l) => live && l && setLayout(l),
      () => undefined
    )
    return () => {
      live = false
    }
  }, [folder])
  const save = (next: FolderLayout): void => {
    setLayout(next)
    const isDefault = next.mode === 'cards' && Object.keys(next.table).length === 0
    void invoke('folder:setLayout', folder, isDefault ? null : next).catch(fail)
  }
  return [layout, save]
}

function LayoutSwitch({
  layout,
  onChange
}: {
  layout: FolderLayout
  onChange(next: FolderLayout): void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="segmented" role="radiogroup" aria-label={t('folder.layout')}>
      {(['cards', 'table'] as const).map((mode) => (
        <button
          key={mode}
          role="radio"
          aria-checked={layout.mode === mode}
          onClick={() => onChange({ ...layout, mode })}
        >
          {t(`folder.${mode}`)}
        </button>
      ))}
    </div>
  )
}

/**
 * What a folder holds, as cards (pages and subfolders, with a preview) or as a table of its
 * pages. Shared by the folder overview and the subpages below a page.
 */
function FolderContents({
  folder,
  items,
  label,
  layout,
  onLayout,
  emptyHint
}: {
  folder: string
  items: TreeNode[]
  label: string
  layout: FolderLayout
  onLayout(next: FolderLayout): void
  emptyHint: string
}): React.JSX.Element {
  const { t } = useTranslation()
  const titleIndex = useStore((s) => s.titleIndex)
  const s = useStore.getState
  const pagePaths = useMemo(
    () => items.map((c) => c.path).filter((p): p is string => Boolean(p)),
    [items]
  )

  const [summaries, setSummaries] = useState<Map<string, PageSummary>>(new Map())
  const load = useCallback(() => {
    if (layout.mode !== 'cards') return
    void invoke('index:summaries', pagePaths).then(
      (list) => setSummaries(new Map(list.map((x) => [x.path, x]))),
      () => setSummaries(new Map())
    )
  }, [pagePaths, layout.mode])
  useEffect(load, [load])
  useIpcEvent('index:updated', load)

  const open = (c: TreeNode): void => {
    if (c.path) s().openPage(c.path)
    else s().navigate({ kind: 'folder', folder: c.folder })
  }

  if (layout.mode === 'table')
    return (
      <TableView
        folder={folder}
        config={layout.table}
        onConfig={(table) => onLayout({ ...layout, table })}
      />
    )
  if (items.length === 0)
    return (
      <div className="folder-empty">
        <p>{emptyHint}</p>
      </div>
    )
  return (
    <ul className="folder-grid" aria-label={label}>
      {items.map((c) => {
        const meta = c.path ? titleIndex.get(c.path) : undefined
        const title = meta?.title ?? c.name
        const sum = c.path ? summaries.get(c.path) : undefined
        const nested = countItems(c)
        const text = c.path ? preview(sum, title) : ''
        return (
          <li key={c.id}>
            <button
              className={`folder-card ${c.kind}`}
              title={c.placeholder ? t('tree.loading') : undefined}
              onClick={() => open(c)}
            >
              <span className="card-icon" aria-hidden="true">
                {meta?.icon ? (
                  <span className="emoji">{meta.icon}</span>
                ) : c.kind === 'folder' ? (
                  <FolderIcon size={18} />
                ) : (
                  <DocIcon size={18} />
                )}
              </span>
              <span className="card-title">{title}</span>
              {c.kind === 'page' && (
                <span className={`card-snippet ${text ? '' : 'none'}`}>
                  {text || t('folder.noText')}
                </span>
              )}
              <span className="card-meta">
                {c.kind === 'folder'
                  ? t('folder.items', { count: nested })
                  : [
                      sum && relativeTime(sum.mtimeMs),
                      nested > 0 && t('folder.subpages', { count: nested })
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Overview of a plain folder: its pages and subfolders as cards, in the tree's order, with a
 * preview and when each page last changed – or as a table. Opening the folder lands here.
 */
export function FolderView({ folder }: { folder: string }): React.JSX.Element {
  const { t } = useTranslation()
  const tree = useStore((s) => s.tree)
  const s = useStore.getState
  const node = useMemo(() => findFolder(tree, folder), [tree, folder])
  const children = useMemo(() => node?.children ?? [], [node])
  const [layout, setLayout] = useFolderLayout(folder)

  if (!node) return <div className="center-message">{t('folder.notFound')}</div>

  const pages = children.filter((c) => c.kind === 'page').length
  const folders = children.length - pages

  return (
    <div className="view folder-view">
      <header className="folder-head">
        <span className="folder-glyph" aria-hidden="true">
          <FolderIcon size={22} />
        </span>
        <div className="folder-title">
          <h1>{node.name}</h1>
          <p className="folder-count">
            {[
              pages > 0 && t('folder.pages', { count: pages }),
              folders > 0 && t('folder.folders', { count: folders })
            ]
              .filter(Boolean)
              .join(' · ') || t('folder.empty')}
          </p>
        </div>
        <LayoutSwitch layout={layout} onChange={setLayout} />
        <button className="button" onClick={() => void s().newFolder(folder)}>
          <FolderPlusIcon size={14} />
          {t('folder.newFolder')}
        </button>
        <button className="button primary" onClick={() => void s().newPage(folder)}>
          <PlusIcon size={14} />
          {t('folder.newPage')}
        </button>
      </header>

      <FolderContents
        folder={folder}
        items={children}
        label={node.name}
        layout={layout}
        onLayout={setLayout}
        emptyHint={t('folder.emptyHint')}
      />
    </div>
  )
}

/**
 * Below a page that has subpages: the same overview a folder has (cards or table), so a page
 * with subpages works like a folder with text of its own. Nothing is written into the page.
 */
export function Subpages({ path }: { path: string }): React.JSX.Element | null {
  const { t } = useTranslation()
  const tree = useStore((s) => s.tree)
  const newPage = useStore((s) => s.newPage)
  const node = useMemo(() => findPage(tree, path), [tree, path])
  const folder = childFolderOf(path)
  const [layout, setLayout] = useFolderLayout(folder)
  const children = node?.children ?? []
  if (!children.length) return null

  return (
    <section className="subpages" aria-label={t('folder.subpagesTitle')}>
      <header className="subpages-head">
        <h2>
          {t('folder.subpagesTitle')} · {children.length}
        </h2>
        <LayoutSwitch layout={layout} onChange={setLayout} />
        <button
          className="button small"
          title={t('folder.newSubpage')}
          onClick={() => void newPage(path)}
        >
          <PlusIcon size={12} />
          {t('folder.newSubpage')}
        </button>
      </header>
      <FolderContents
        folder={folder}
        items={children}
        label={t('folder.subpagesTitle')}
        layout={layout}
        onLayout={setLayout}
        emptyHint=""
      />
    </section>
  )
}
