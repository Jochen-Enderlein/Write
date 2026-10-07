import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '../api'
import { renderMarkdownHtml } from '../editor/renderMarkdown'
import { titleOf, useStore } from '../store'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { ShareIcon } from './Icons'

/** Page body for sharing: the title as a heading on top, unless the text starts with it already. */
function withTitle(title: string, body: string): string {
  const text = body.replace(/^\n+/, '')
  const first = /^#\s+(.+)$/m.exec(text.split('\n')[0] ?? '')?.[1]?.trim()
  return first === title.trim() ? text : `# ${title}\n\n${text}`
}

/**
 * Shares the open page – or, with text selected, just that part – as Markdown, PDF or HTML
 * through the macOS share menu, or copies it as Markdown.
 */
export function ShareButton({ path }: { path: string }): React.JSX.Element {
  const { t } = useTranslation()
  const [menu, setMenu] = useState<{ x: number; y: number; selection: string | null } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  // Pressing the button while the menu is open closes it (as an outside press); the click
  // that follows must not open it again
  const pressedWhileOpen = useRef(false)
  const token = useStore((s) => s.shareToken)

  const open = (): void => {
    const r = button.current?.getBoundingClientRect()
    const editor = useStore.getState().editor
    setMenu({
      x: r ? r.right - 220 : 200,
      y: r ? r.bottom + 6 : 60,
      selection: editor?.selectionMarkdown() ?? null
    })
  }

  // ⌘-menu „Teilen …“
  const first = useRef(token)
  useEffect(() => {
    if (token !== first.current) open()
  }, [token])

  const share = async (format: 'md' | 'html' | 'pdf', selection: string | null): Promise<void> => {
    const s = useStore.getState()
    const editor = s.editor
    if (!editor || editor.path !== path) return
    const pageTitle = titleOf(path)
    const title = selection ? t('share.selectionTitle', { title: pageTitle }) : pageTitle
    const icon = s.titleIndex.get(path)?.icon ?? null
    try {
      const markdown = selection ?? withTitle(pageTitle, editor.bodyMarkdown())
      const content =
        format === 'md'
          ? markdown
          : selection
            ? await renderMarkdownHtml(path, selection, title, icon)
            : editor.exportHtml()
      await invoke('page:share', { format, title, content })
    } catch (err) {
      s.fail(err)
    }
  }

  const copy = async (selection: string | null): Promise<void> => {
    const s = useStore.getState()
    const editor = s.editor
    if (!editor) return
    const markdown = selection ?? withTitle(titleOf(path), editor.bodyMarkdown())
    await invoke('clipboard:write', markdown)
    s.notify(selection ? t('share.copiedSelection') : t('share.copiedPage'))
  }

  const items = (selection: string | null): MenuItem[] => [
    { label: t('share.markdown'), onSelect: () => void share('md', selection) },
    { label: t('share.pdf'), onSelect: () => void share('pdf', selection) },
    { label: t('share.html'), onSelect: () => void share('html', selection) },
    {
      label: t('share.copyMarkdown'),
      onSelect: () => void copy(selection),
      separatorBefore: true
    }
  ]

  return (
    <>
      <button
        ref={button}
        className="icon-button"
        title={t('share.button')}
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        // Keep the editor's selection: the button must not take focus on press
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={() => (pressedWhileOpen.current = menu !== null)}
        onClick={() => {
          if (!pressedWhileOpen.current) open()
          pressedWhileOpen.current = false
        }}
      >
        <ShareIcon />
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          heading={menu.selection ? t('share.headingSelection') : t('share.headingPage')}
          items={items(menu.selection)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
