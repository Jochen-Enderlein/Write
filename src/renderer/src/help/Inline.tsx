import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { acceleratorGlyphs, COMMANDS } from '@shared/keymap'
import { isHelpTopic, type HelpTopicId } from './model'

/**
 * `**fett**`, `_kursiv_`, `` `code` `` (or ``` `` code with ` `` ``` for backticks inside),
 * `{{cmd:id}}`, `{{keys:…}}` and `[Text](topic:id)`.
 */
const TOKEN =
  /\*\*(?<bold>.+?)\*\*|(?<![\w`])_(?<em>[^_\n]+?)_(?![\w`])|``\s(?<code2>.+?)\s``|`(?<code>[^`]+)`|\{\{(?<kind>cmd|keys):(?<keys>[^}]+)\}\}|\[(?<label>[^\]]+)\]\(topic:(?<topic>[\w-]+)\)/g

/** Key caps for an accelerator: `CmdOrCtrl+Shift+F` → ⇧ ⌘ F, one cap per key. */
export function Keys({ accelerator }: { accelerator: string }): React.JSX.Element {
  const { t } = useTranslation()
  const glyphs = acceleratorGlyphs(accelerator, t('keys.space'))
  // Modifier glyphs are single characters; whatever follows them is the key itself
  const m = /^([⌃⌥⇧⌘]*)(.*)$/u.exec(glyphs)!
  const caps = [...m[1]!, m[2]!].filter(Boolean)
  return (
    <span className="help-keys" role="img" aria-label={glyphs}>
      {caps.map((c, i) => (
        <span key={i} className="help-key" aria-hidden="true">
          {c.trim()}
        </span>
      ))}
    </span>
  )
}

export function commandKeys(id: string): string | undefined {
  return COMMANDS.find((c) => c.id === id)?.accelerator
}

/** Wraps every occurrence of the search words in `<mark>`. */
function Highlight({ text, words }: { text: string; words: string[] }): React.JSX.Element {
  if (!words.length) return <>{text}</>
  const re = new RegExp(
    `(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  )
  const parts = text.split(re)
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p))}</>
}

export function Inline({
  text,
  words = [],
  onTopic
}: {
  text: string
  words?: string[]
  onTopic(id: HelpTopicId): void
}): React.JSX.Element {
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push(<Highlight text={text.slice(last, m.index)} words={words} />)
    const g = m.groups!
    if (g.bold !== undefined)
      out.push(
        <strong>
          <Highlight text={g.bold} words={words} />
        </strong>
      )
    else if (g.em !== undefined)
      out.push(
        <em>
          <Highlight text={g.em} words={words} />
        </em>
      )
    else if (g.code !== undefined || g.code2 !== undefined)
      out.push(<code>{g.code ?? g.code2}</code>)
    else if (g.kind === 'cmd') {
      const acc = commandKeys(g.keys!)
      if (acc) out.push(<Keys accelerator={acc} />)
    } else if (g.kind === 'keys') out.push(<Keys accelerator={g.keys!} />)
    else if (g.label !== undefined && isHelpTopic(g.topic)) {
      const id = g.topic
      out.push(
        <a
          href={`#${id}`}
          className="help-topic-link"
          onClick={(e) => {
            e.preventDefault()
            onTopic(id)
          }}
        >
          <Highlight text={g.label} words={words} />
        </a>
      )
    } else out.push(m[0])
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(<Highlight text={text.slice(last)} words={words} />)
  return (
    <>
      {out.map((n, i) => (
        <Fragment key={i}>{n}</Fragment>
      ))}
    </>
  )
}

/** Plain text of inline marks, for the search. */
export function inlineText(text: string): string {
  return text.replace(TOKEN, (...args) => {
    const g = args.at(-1) as Record<string, string | undefined>
    return g.bold ?? g.em ?? g.code ?? g.code2 ?? g.label ?? ' '
  })
}
