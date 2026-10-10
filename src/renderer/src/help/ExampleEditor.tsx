import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { syntaxHighlighter } from '@blocknote/code-block'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { type Block, blocksToMarkdown, markdownToBlocks } from '@shared/markdown'
import { invoke } from '../api'
import { useColorScheme } from '../lib/hooks'
import { blockIds } from '../editor/blockIds'
import { codeIndent } from '../editor/codeIndent'
import { typing } from '../editor/typing'
import i18next from '../i18n'
import { prepareBlocks, schema } from '../editor/schema'
import { CheckIcon } from '../components/Icons'

let exampleIds = 0
const makeId = (): string => `ex-${(++exampleIds).toString(36)}`

type Face = 'result' | 'markdown'

/**
 * A live example: the real editor with the real schema, so what you see is what Write does.
 * Edits stay in the help (nothing is saved); "Markdown" shows what would land in the file.
 */
export function ExampleEditor({
  markdown,
  caption
}: {
  markdown: string
  caption?: string
}): React.JSX.Element {
  const { t } = useTranslation()
  const [face, setFace] = useState<Face>('result')
  // Bumped by "Reset" to build the editor again from the original Markdown
  const [generation, setGeneration] = useState(0)
  const [source, setSource] = useState(markdown)
  const [copied, setCopied] = useState(false)
  const changed = source.trim() !== markdown.trim()

  const copy = async (): Promise<void> => {
    await invoke('clipboard:write', source)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <figure className="help-example">
      <div className="help-example-bar">
        <div className="help-segmented" role="radiogroup" aria-label={t('help.exampleView')}>
          {(['result', 'markdown'] as const).map((f) => (
            <button key={f} role="radio" aria-checked={face === f} onClick={() => setFace(f)}>
              {t(f === 'result' ? 'help.exampleResult' : 'help.exampleMarkdown')}
            </button>
          ))}
        </div>
        <span className="help-example-hint">
          {face === 'result' ? t('help.exampleEditable') : t('help.exampleFile')}
        </span>
        <div className="spacer" />
        {changed && (
          <button
            className="help-link-button"
            onClick={() => {
              setSource(markdown)
              setGeneration((g) => g + 1)
            }}
          >
            {t('help.exampleReset')}
          </button>
        )}
        <button className="help-link-button" onClick={() => void copy()}>
          {copied ? (
            <>
              <CheckIcon size={12} /> {t('help.copied')}
            </>
          ) : (
            t('help.copyMarkdown')
          )}
        </button>
      </div>
      {/* The editor stays mounted while the Markdown shows, so edits survive switching */}
      <div className="help-example-body" hidden={face !== 'result'}>
        <LiveEditor key={generation} markdown={markdown} onMarkdown={setSource} />
      </div>
      {face === 'markdown' && (
        <pre className="help-example-source" aria-label={t('help.exampleMarkdown')}>
          {source.trimEnd()}
        </pre>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

function LiveEditor({
  markdown,
  onMarkdown
}: {
  markdown: string
  onMarkdown(md: string): void
}): React.JSX.Element {
  const scheme = useColorScheme()
  const initial = useMemo(() => prepareBlocks(markdownToBlocks(markdown, makeId)), [markdown])
  const editor = useCreateBlockNote(
    {
      schema,
      initialContent: initial.length ? (initial as never) : undefined,
      // The help shows the default: smart punctuation on, in the help's language
      extensions: [
        syntaxHighlighter,
        codeIndent,
        blockIds,
        typing(
          () => true,
          () => (i18next.language === 'en' ? 'en' : 'de')
        )
      ],
      tables: { headers: true, splitCells: false, cellBackgroundColor: false, cellTextColor: false }
    },
    []
  )
  const onChange = useCallback(
    () => onMarkdown(blocksToMarkdown(editor.document as unknown as Block[])),
    [editor, onMarkdown]
  )
  return (
    <BlockNoteView
      editor={editor}
      theme={scheme}
      onChange={onChange}
      sideMenu={false}
      slashMenu={false}
      className="write-editor"
    />
  )
}
