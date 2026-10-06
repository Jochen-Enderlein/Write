import { useEffect, useMemo, useRef, useState } from 'react'
import { Tree, type NodeApi, type NodeRendererProps, type TreeApi } from 'react-arborist'
import { useTranslation } from 'react-i18next'
import { basename } from '@shared/paths'
import type { TreeNode } from '@shared/types'
import { invoke } from '../api'
import { useElementSize } from '../lib/hooks'
import { applyMoves, useStore } from '../store'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { ChevronIcon, DocIcon, FolderIcon, MoreIcon, PlusIcon } from './Icons'

const OPEN_KEY = 'tree:open'

function loadOpenState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function PageTree(): React.JSX.Element {
  const { t } = useTranslation()
  const tree = useStore((s) => s.tree)
  const view = useStore((s) => s.view)
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const api = useRef<TreeApi<TreeNode> | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null)
  const initialOpen = useMemo(loadOpenState, [])
  const current = view.kind === 'page' ? view.path : view.kind === 'folder' ? view.folder : null
  const pendingEdit = useStore((s) => s.pendingTreeEdit)

  // A freshly created folder goes straight into rename mode
  useEffect(() => {
    const a = api.current
    if (!a || !pendingEdit) return
    const node = a.get(pendingEdit)
    if (!node) return
    useStore.setState({ pendingTreeEdit: null })
    node.openParents()
    void a.scrollTo(pendingEdit)
    void a.edit(pendingEdit)
  }, [pendingEdit, tree])

  const openMenu = (x: number, y: number, node: TreeNode): void => setMenu({ x, y, node })

  // Keep the selection on the open page, revealing it inside collapsed parents
  useEffect(() => {
    const a = api.current
    if (!a || !current) return
    const node = a.get(current)
    if (!node) return
    node.openParents()
    // Follow the open page without stealing focus from the editor
    if (!node.isSelected) a.select(current, { focus: false })
    void a.scrollTo(current)
  }, [current, tree])

  const persistOpen = (): void => {
    const a = api.current
    if (!a) return
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(a.openState))
    } catch {
      // per-viewer convenience only
    }
  }

  if (!tree.length) {
    return (
      <div className="tree-container" ref={containerRef}>
        <div className="empty-tree">{t('sidebar.emptyTree')}</div>
      </div>
    )
  }

  return (
    <div
      className="tree-container"
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        // The tree handles ⌫ itself; forward-delete (fn ⌫ / Entf) should do the same
        if (e.key !== 'Delete' || (e.target as Element).closest('input')) return
        const node = api.current?.selectedNodes[0]
        if (!node) return
        e.preventDefault()
        if (node.data.kind === 'folder') void useStore.getState().trashFolder(node.data.folder)
        else if (node.data.path) void useStore.getState().trashPage(node.data.path)
      }}
    >
      {size.height > 0 && (
        <Tree<TreeNode>
          ref={api}
          data={tree}
          idAccessor="id"
          childrenAccessor={(d) => d.children ?? null}
          initialOpenState={initialOpen}
          width={size.width}
          height={size.height}
          rowHeight={28}
          indent={14}
          overscanCount={12}
          padding={2}
          disableMultiSelection
          disableDrag={(d) => Boolean(d.placeholder)}
          disableDrop={({ parentNode, dragNodes }) =>
            dragNodes.some((d) => parentNode.id === d.id || isDescendant(parentNode, d.id))
          }
          selection={current ?? undefined}
          onToggle={persistOpen}
          onActivate={(node) => {
            // A folder opens its overview (and unfolds); the chevron alone only folds
            if (node.data.kind === 'folder') {
              node.open()
              useStore.getState().navigate({ kind: 'folder', folder: node.data.folder })
            } else if (node.data.path) useStore.getState().openPage(node.data.path)
          }}
          onRename={async ({ id, name, node }) => {
            if (node.data.kind === 'folder') return useStore.getState().renameFolder(id, name)
            const next = await useStore.getState().renamePage(id, name)
            if (next && next !== id) applyMoves([{ from: id, to: next }])
          }}
          onDelete={({ nodes }) => {
            for (const n of nodes) {
              if (n.data.kind === 'folder') void useStore.getState().trashFolder(n.data.folder)
              else if (n.data.path) void useStore.getState().trashPage(n.data.path)
            }
          }}
          onMove={async ({ dragIds, dragNodes, parentId, parentNode, index }) => {
            const id = dragIds[0]
            const drag = dragNodes[0]
            if (!id || !drag) return
            const s = useStore.getState()
            const parent = parentNode && !parentNode.isRoot ? parentNode : null
            const oldParent = drag.parent && !drag.parent.isRoot ? drag.parent.id : null
            const sameParent = oldParent === (parent ? (parentId ?? null) : null)
            let newId: string | null = id
            if (!sameParent) {
              // Into a page = below it; into a folder = inside; no parent = top level
              const target = parent
                ? parent.data.kind === 'page'
                  ? parent.data.path!
                  : parent.data.folder
                : ''
              newId =
                drag.data.kind === 'folder'
                  ? await s.moveFolder(drag.data.folder, target)
                  : await s.movePage(id, target)
              if (!newId) return
            }
            // Remember where it was dropped among its new siblings
            const children = (parent ?? api.current?.root)?.children ?? []
            const siblings = children.map((c) => c.id).filter((x) => x !== id)
            let at = index
            const old = children.findIndex((c) => c.id === id)
            if (sameParent && old !== -1 && old < index) at -= 1
            siblings.splice(Math.max(0, Math.min(at, siblings.length)), 0, newId)
            try {
              await invoke(
                'tree:setOrder',
                parent ? parent.data.folder : '',
                siblings.map(basename)
              )
            } catch (err) {
              s.fail(err)
            }
          }}
          rowClassName="tree-row-outer"
        >
          {(props) => <Row {...props} onMenu={openMenu} />}
        </Tree>
      )}
      {menu && (
        <TreeMenu
          {...menu}
          onClose={() => setMenu(null)}
          onRename={(id) => api.current?.edit(id)}
        />
      )}
    </div>
  )
}

function isDescendant(node: NodeApi<TreeNode> | null, id: string): boolean {
  let n = node
  while (n) {
    if (n.id === id) return true
    n = n.parent
  }
  return false
}

function Row({
  node,
  style,
  dragHandle,
  onMenu
}: NodeRendererProps<TreeNode> & {
  onMenu(x: number, y: number, node: TreeNode): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const meta = useStore((s) => (node.data.path ? s.titleIndex.get(node.data.path) : undefined))
  const d = node.data
  const icon = meta?.icon ?? null
  const label = meta?.title ?? d.name
  const classes = [
    'tree-row',
    node.isSelected && 'selected',
    node.willReceiveDrop && 'drop-target',
    d.placeholder && 'placeholder'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={dragHandle}
      style={style}
      className={classes}
      title={d.placeholder ? t('tree.loading') : undefined}
      onPointerDown={(e) => {
        // Highlight on press for immediate feedback; the page opens on release (onActivate), so
        // starting a drag to reorder doesn't switch pages. ⌃-click is a secondary click on macOS.
        if (e.button === 0 && !e.ctrlKey && !node.isEditing)
          node.tree.select(node.id, { focus: false })
      }}
      onDragEnd={() => {
        // Pressing selected the row; if it was dragged elsewhere, the open page stays selected
        const v = useStore.getState().view
        if (v.kind === 'page' && node.tree.get(v.path)) node.tree.select(v.path, { focus: false })
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onMenu(e.clientX, e.clientY, d)
      }}
      onDoubleClick={() => node.edit()}
    >
      <button
        className={`chevron ${node.isOpen ? 'open' : ''} ${node.isLeaf ? 'leaf' : ''}`}
        tabIndex={-1}
        aria-label={node.isOpen ? t('tree.collapse') : t('tree.expand')}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          node.toggle()
        }}
      >
        <ChevronIcon />
      </button>
      <span className="icon">
        {icon ? (
          <span className="emoji">{icon}</span>
        ) : d.kind === 'folder' ? (
          <FolderIcon size={14} />
        ) : (
          <DocIcon size={14} />
        )}
      </span>
      {node.isEditing ? (
        <input
          autoFocus
          defaultValue={label}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => node.submit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') node.reset()
            if (e.key === 'Enter') node.submit(e.currentTarget.value)
          }}
        />
      ) : (
        <>
          <span className="name">{label}</span>
          {/* Every action is also reachable without a secondary click */}
          <span className="row-actions">
            <button
              className="row-action"
              tabIndex={-1}
              title={d.kind === 'folder' ? t('tree.newPageHere') : t('tree.addSubpage')}
              aria-label={d.kind === 'folder' ? t('tree.newPageHere') : t('tree.addSubpage')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                node.open()
                void useStore.getState().newPage(d.path ?? d.folder)
              }}
            >
              <PlusIcon size={13} />
            </button>
            <button
              className="row-action"
              tabIndex={-1}
              title={t('tree.actions', { name: label })}
              aria-label={t('tree.actions', { name: label })}
              aria-haspopup="menu"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                const r = e.currentTarget.getBoundingClientRect()
                onMenu(r.left, r.bottom + 4, d)
              }}
            >
              <MoreIcon size={14} />
            </button>
          </span>
        </>
      )}
    </div>
  )
}

function TreeMenu({
  x,
  y,
  node,
  onClose,
  onRename
}: {
  x: number
  y: number
  node: TreeNode
  onClose(): void
  onRename(id: string): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const s = useStore.getState()
  if (node.kind === 'folder') {
    const folderItems: MenuItem[] = [
      { label: t('tree.newPageHere'), onSelect: () => void s.newPage(node.folder) },
      { label: t('tree.newFolderHere'), onSelect: () => void s.newFolder(node.folder) },
      { label: t('tree.rename'), onSelect: () => onRename(node.id), separatorBefore: true },
      { label: t('tree.reveal'), onSelect: () => void invoke('page:reveal', node.folder) },
      {
        label: t('tree.trash'),
        danger: true,
        separatorBefore: true,
        onSelect: () => void s.trashFolder(node.folder)
      }
    ]
    return <ContextMenu x={x} y={y} items={folderItems} onClose={onClose} />
  }
  const path = node.path!
  const fav = s.favorites.includes(path)
  const items: MenuItem[] = [
    { label: t('tree.newSubpage'), onSelect: () => void s.newPage(path) },
    { label: t('tree.newFolderHere'), onSelect: () => void s.newFolder(path) },
    { label: t('tree.rename'), onSelect: () => onRename(node.id) },
    {
      label: t('tree.move'),
      onSelect: () => {
        s.openPage(path)
        s.setPalette(true, 'move')
      }
    },
    {
      label: fav ? t('tree.unfavorite') : t('tree.favorite'),
      onSelect: () => void s.toggleFavorite(path),
      separatorBefore: true
    },
    { label: t('tree.newWindow'), onSelect: () => void s.openInNewWindow(path) },
    { label: t('tree.reveal'), onSelect: () => void invoke('page:reveal', path) },
    {
      label: t('tree.trash'),
      danger: true,
      separatorBefore: true,
      onSelect: () => void s.trashPage(path)
    }
  ]
  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />
}
