import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PageSummary, TreeNode } from '@shared/types'
import { invoke } from '../api'
import { relativeTime, useIpcEvent } from '../lib/hooks'
import { useStore } from '../store'
import { DocIcon, FolderIcon, FolderPlusIcon, PlusIcon } from './Icons'

/** The folder's node in the tree, searched depth-first. */
function findFolder(nodes: TreeNode[], folder: string): TreeNode | null {
  for (const n of nodes) {
    if (n.kind === 'folder' && n.folder === folder) return n
    const hit = n.children ? findFolder(n.children, folder) : null
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

/**
 * Overview of a plain folder: its pages and subfolders as cards, in the tree's order, with a
 * preview and when each page last changed. Opening the folder in the tree lands here.
 */
export function FolderView({ folder }: { folder: string }): React.JSX.Element {
  const { t } = useTranslation()
  const tree = useStore((s) => s.tree)
  const titleIndex = useStore((s) => s.titleIndex)
  const s = useStore.getState
  const node = useMemo(() => findFolder(tree, folder), [tree, folder])
  const children = useMemo(() => node?.children ?? [], [node])
  const pagePaths = useMemo(
    () => children.map((c) => c.path).filter((p): p is string => Boolean(p)),
    [children]
  )

  const [summaries, setSummaries] = useState<Map<string, PageSummary>>(new Map())
  const load = useCallback(() => {
    void invoke('index:summaries', pagePaths).then(
      (list) => setSummaries(new Map(list.map((x) => [x.path, x]))),
      () => setSummaries(new Map())
    )
  }, [pagePaths])
  useEffect(load, [load])
  useIpcEvent('index:updated', load)

  if (!node) return <div className="center-message">{t('folder.notFound')}</div>

  const pages = children.filter((c) => c.kind === 'page').length
  const folders = children.length - pages
  const open = (c: TreeNode): void => {
    if (c.path) s().openPage(c.path)
    else s().navigate({ kind: 'folder', folder: c.folder })
  }

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
        <button className="button" onClick={() => void s().newFolder(folder)}>
          <FolderPlusIcon size={14} />
          {t('folder.newFolder')}
        </button>
        <button className="button primary" onClick={() => void s().newPage(folder)}>
          <PlusIcon size={14} />
          {t('folder.newPage')}
        </button>
      </header>

      {children.length === 0 ? (
        <div className="folder-empty">
          <p>{t('folder.emptyHint')}</p>
        </div>
      ) : (
        <ul className="folder-grid" aria-label={node.name}>
          {children.map((c) => {
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
      )}
    </div>
  )
}
