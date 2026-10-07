import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { markdownToBlocks } from '@shared/markdown'
import { resolveRelative } from '@shared/paths'
import i18next from '../i18n'
import { useColorScheme } from '../lib/hooks'
import { buildExportHtml } from './exportHtml'
import { assetUrl, makeId } from './PageEditor'
import { prepareBlocks, schema } from './schema'

export interface MarkdownPreviewHandle {
  exportHtml(title: string, icon: string | null): string
}

/**
 * Read-only rendering of a Markdown body, with the same blocks and look as the rich editor
 * (wiki links, Mermaid, tables, images). Follows the text with a short delay while typing.
 */
export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, { path: string; body: string }>(
  function MarkdownPreview({ path, body }, ref) {
    const scheme = useColorScheme()
    const editor = useCreateBlockNote(
      {
        schema,
        tables: {
          headers: true,
          splitCells: false,
          cellBackgroundColor: false,
          cellTextColor: false
        },
        resolveFileUrl: async (url: string) => {
          const rel = resolveRelative(path, url)
          return rel === null ? url : assetUrl(rel)
        }
      },
      []
    )
    const first = useRef(true)

    useEffect(() => {
      const show = (): void => {
        const blocks = prepareBlocks(markdownToBlocks(body, makeId))
        editor.replaceBlocks(
          editor.document,
          (blocks.length ? blocks : [{ type: 'paragraph' }]) as never
        )
      }
      if (first.current) {
        first.current = false
        show()
        return
      }
      const id = setTimeout(show, 200)
      return () => clearTimeout(id)
    }, [body, editor])

    useImperativeHandle(
      ref,
      () => ({
        exportHtml: (title, icon) =>
          buildExportHtml(editor.domElement, title, icon, i18next.language)
      }),
      [editor]
    )

    return (
      <BlockNoteView
        editor={editor}
        editable={false}
        theme={scheme}
        formattingToolbar={false}
        slashMenu={false}
        sideMenu={false}
        linkToolbar={false}
        className="write-editor markdown-preview"
      />
    )
  }
)
