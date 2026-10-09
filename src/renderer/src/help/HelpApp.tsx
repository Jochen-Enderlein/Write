import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COMMANDS } from '@shared/keymap'
import { invoke } from '../api'
import { useIpcEvent } from '../lib/hooks'
import { createSpring } from '../lib/spring'
import {
  BoltIcon,
  CalendarIcon,
  CalloutIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  CommandIcon,
  DiagramIcon,
  DocIcon,
  EmbedIcon,
  FocusIcon,
  FootnoteIcon,
  GearIcon,
  GraphIcon,
  LinkIcon,
  ModeMarkdownIcon,
  PanesIcon,
  PenIcon,
  PilcrowIcon,
  PropertiesIcon,
  SearchIcon,
  ShareIcon,
  SigmaIcon,
  SparkleIcon,
  TableIcon,
  TagIcon,
  TemplateIcon,
  TrashIcon,
  VaultIcon,
  WarningIcon
} from '../components/Icons'
import { CONTENT } from './content'
import { ExampleEditor } from './ExampleEditor'
import { Inline, Keys, commandKeys, inlineText } from './Inline'
import {
  HELP_GROUPS,
  HELP_TOPICS,
  isHelpTopic,
  type HelpBlock,
  type HelpContent,
  type HelpTopicId
} from './model'

const ICONS: Record<HelpTopicId, (p: { size?: number }) => React.JSX.Element> = {
  welcome: VaultIcon,
  pages: DocIcon,
  writing: PenIcon,
  markdown: ModeMarkdownIcon,
  links: LinkIcon,
  blockrefs: PilcrowIcon,
  embeds: EmbedIcon,
  tags: TagIcon,
  graph: GraphIcon,
  properties: PropertiesIcon,
  tables: TableIcon,
  tasks: CheckIcon,
  journal: CalendarIcon,
  templates: TemplateIcon,
  callouts: CalloutIcon,
  code: DiagramIcon,
  math: SigmaIcon,
  footnotes: FootnoteIcon,
  split: PanesIcon,
  search: SearchIcon,
  focus: FocusIcon,
  capture: BoltIcon,
  share: ShareIcon,
  history: ClockIcon,
  conflicts: WarningIcon,
  trash: TrashIcon,
  ai: SparkleIcon,
  shortcuts: CommandIcon,
  settings: GearIcon
}

/** Group of each topic; it colours the topic's icon tile. */
const GROUP_OF = Object.fromEntries(
  HELP_GROUPS.flatMap((g) => g.topics.map((id) => [id, g.id]))
) as Record<HelpTopicId, string>

const TOPIC_KEY = 'help:topic'

function startTopic(): HelpTopicId {
  const asked = new URLSearchParams(location.search).get('topic')
  if (isHelpTopic(asked)) return asked
  try {
    const last = localStorage.getItem(TOPIC_KEY)
    if (isHelpTopic(last)) return last
  } catch {
    // per-viewer convenience only
  }
  return 'welcome'
}

/** All text of a topic, lower case, for the search. */
function searchText(content: HelpContent, id: HelpTopicId): string {
  const topic = content.topics[id]
  const parts: string[] = [topic.title, topic.summary, ...(topic.keywords ?? [])]
  for (const b of topic.blocks) {
    if ('text' in b) parts.push(inlineText(b.text))
    if ('items' in b && b.kind !== 'keys') parts.push(...b.items.map(inlineText))
    if (b.kind === 'example') parts.push(b.markdown, b.caption ?? '')
    if (b.kind === 'try') parts.push(b.label)
  }
  return parts.join(' ').toLowerCase()
}

export function HelpApp(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const content = CONTENT[i18n.language === 'en' ? 'en' : 'de']
  const [topic, setTopic] = useState<HelpTopicId>(startTopic)
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  const words = useMemo(
    () =>
      query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 1),
    [query]
  )
  const index = useMemo(
    () => new Map(HELP_TOPICS.map((id) => [id, searchText(content, id)])),
    [content]
  )
  const matches = useMemo(
    () =>
      words.length
        ? HELP_TOPICS.filter((id) => words.every((w) => index.get(id)!.includes(w)))
        : HELP_TOPICS,
    [words, index]
  )

  const open = useCallback((id: HelpTopicId) => {
    setTopic(id)
    try {
      localStorage.setItem(TOPIC_KEY, id)
    } catch {
      // per-viewer convenience only
    }
  }, [])

  // A new topic starts at the top
  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
    setScrolled(false)
  }, [topic])

  useEffect(() => {
    document.title = `${t('help.windowTitle')} – ${content.topics[topic].title}`
  }, [t, content, topic])

  useIpcEvent('help:show', (id) => {
    if (isHelpTopic(id)) {
      setQuery('')
      open(id)
    }
  })
  useIpcEvent('help:find', () => {
    search.current?.focus()
    search.current?.select()
  })

  // Typing a search shows the best match right away, like Spotlight
  useEffect(() => {
    if (words.length && matches.length && !matches.includes(topic)) open(matches[0]!)
  }, [words, matches, topic, open])

  const step = (dir: 1 | -1): void => {
    const list = matches
    const i = list.indexOf(topic)
    const next = list[Math.max(0, Math.min(list.length - 1, (i === -1 ? -1 : i) + dir))]
    if (next) open(next)
  }

  return (
    <div className="help-app">
      <aside className="help-sidebar">
        <div className="help-titlebar" />
        <label className="help-search">
          <SearchIcon size={14} />
          <input
            ref={search}
            type="search"
            value={query}
            placeholder={t('help.search')}
            aria-label={t('help.search')}
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                step(e.key === 'ArrowDown' ? 1 : -1)
              } else if (e.key === 'Escape' && query) {
                e.preventDefault()
                setQuery('')
              } else if (e.key === 'Enter') {
                e.preventDefault()
                scroller.current?.focus()
              }
            }}
          />
          {query && (
            <button
              className="help-search-clear"
              aria-label={t('help.clearSearch')}
              onClick={() => {
                setQuery('')
                search.current?.focus()
              }}
            >
              <CloseIcon size={12} />
            </button>
          )}
        </label>
        <TopicList content={content} topic={topic} matches={matches} onOpen={open} onStep={step} />
      </aside>
      <main className={`help-main ${scrolled ? 'scrolled' : ''}`}>
        <div className="help-toolbar" />
        <div
          className="help-scroll"
          ref={scroller}
          tabIndex={-1}
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
        >
          {matches.length ? (
            <TopicPage
              key={`${topic}:${i18n.language}`}
              id={topic}
              content={content}
              words={words}
              onTopic={(id) => {
                setQuery('')
                open(id)
              }}
            />
          ) : (
            <div className="help-empty">
              <SearchIcon size={28} />
              <p>{t('help.noResults', { query })}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

/** The sidebar: groups of topics; the selection is a pill that glides to the chosen row. */
function TopicList({
  content,
  topic,
  matches,
  onOpen,
  onStep
}: {
  content: HelpContent
  topic: HelpTopicId
  matches: HelpTopicId[]
  onOpen(id: HelpTopicId): void
  onStep(dir: 1 | -1): void
}): React.JSX.Element {
  const list = useRef<HTMLElement>(null)
  const pill = useRef<HTMLDivElement>(null)
  const placed = useRef(false)
  const spring = useMemo(
    () =>
      createSpring(0, (y) => {
        if (pill.current) pill.current.style.transform = `translateY(${y}px)`
      }),
    []
  )

  // The pill follows the selection; the first placement and a filtered list jump directly
  useLayoutEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(`[data-topic="${topic}"]`)
    const el = pill.current
    if (!row || !el) {
      if (el) el.style.opacity = '0'
      return
    }
    el.style.opacity = '1'
    el.style.height = `${row.offsetHeight}px`
    if (!placed.current) {
      spring.set(row.offsetTop)
      placed.current = true
    } else spring.to(row.offsetTop, { damping: 1, response: 0.28 })
    row.scrollIntoView({ block: 'nearest' })
  }, [topic, matches, spring])

  const visible = new Set(matches)
  return (
    <nav
      className="help-topics"
      ref={list}
      aria-label={useTranslation().t('help.topics')}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
        e.preventDefault()
        onStep(e.key === 'ArrowDown' ? 1 : -1)
        requestAnimationFrame(() =>
          list.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus()
        )
      }}
    >
      <div className="help-pill" ref={pill} aria-hidden="true" />
      {HELP_GROUPS.map((g) => {
        const topics = g.topics.filter((id) => visible.has(id))
        if (!topics.length) return null
        return (
          <div key={g.id} className="help-group">
            <div className="help-group-title">{content.groups[g.id]}</div>
            {topics.map((id) => {
              const Icon = ICONS[id]
              return (
                <button
                  key={id}
                  data-topic={id}
                  data-group={g.id}
                  className="help-topic"
                  aria-current={id === topic ? 'page' : undefined}
                  onPointerDown={(e) => {
                    // Select on press, like the sidebar of System Settings
                    if (e.button === 0) onOpen(id)
                  }}
                  onClick={() => onOpen(id)}
                >
                  <span className="help-topic-icon">
                    <Icon size={15} />
                  </span>
                  <span className="help-topic-title">{content.topics[id].title}</span>
                </button>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}

function TopicPage({
  id,
  content,
  words,
  onTopic
}: {
  id: HelpTopicId
  content: HelpContent
  words: string[]
  onTopic(id: HelpTopicId): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const topic = content.topics[id]
  const order = HELP_TOPICS.indexOf(id)
  const prev = HELP_TOPICS[order - 1]
  const next = HELP_TOPICS[order + 1]
  const inline = (text: string): React.JSX.Element => (
    <Inline text={text} words={words} onTopic={onTopic} />
  )

  return (
    <article className="help-page">
      <header className="help-head">
        <span className="help-head-icon" data-group={GROUP_OF[id]} aria-hidden="true">
          {(() => {
            const Icon = ICONS[id]
            return <Icon size={22} />
          })()}
        </span>
        <h1>{topic.title}</h1>
        <p className="help-summary">{inline(topic.summary)}</p>
      </header>
      {topic.blocks.map((b, i) => (
        <Block key={i} block={b} inline={inline} />
      ))}
      {topic.related && topic.related.length > 0 && (
        <section className="help-related">
          <h2>{t('help.related')}</h2>
          <div className="help-related-grid">
            {topic.related.map((r) => {
              const Icon = ICONS[r]
              return (
                <button
                  key={r}
                  className="help-related-card"
                  data-group={GROUP_OF[r]}
                  onClick={() => onTopic(r)}
                >
                  <Icon size={16} />
                  <span>
                    <strong>{content.topics[r].title}</strong>
                    <small>{inlineText(content.topics[r].summary)}</small>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}
      <nav className="help-pager" aria-label={t('help.pager')}>
        {prev ? (
          <button onClick={() => onTopic(prev)}>
            <small>{t('help.previous')}</small>
            {content.topics[prev].title}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button className="next" onClick={() => onTopic(next)}>
            <small>{t('help.next')}</small>
            {content.topics[next].title}
          </button>
        )}
      </nav>
    </article>
  )
}

function Block({
  block,
  inline
}: {
  block: HelpBlock
  inline(text: string): React.JSX.Element
}): React.JSX.Element | null {
  const { t } = useTranslation()
  switch (block.kind) {
    case 'p':
      return <p>{inline(block.text)}</p>
    case 'h':
      return <h2>{inline(block.text)}</h2>
    case 'steps':
      return (
        <ol className="help-steps">
          {block.items.map((s, i) => (
            <li key={i}>{inline(s)}</li>
          ))}
        </ol>
      )
    case 'list':
      return (
        <ul className="help-list">
          {block.items.map((s, i) => (
            <li key={i}>{inline(s)}</li>
          ))}
        </ul>
      )
    case 'tip':
    case 'note':
      return (
        <aside className={`help-callout ${block.kind}`}>
          <strong>{t(block.kind === 'tip' ? 'help.tip' : 'help.note')}</strong>
          <span>{inline(block.text)}</span>
        </aside>
      )
    case 'example':
      return <ExampleEditor markdown={block.markdown} caption={block.caption} />
    case 'keys':
      return (
        <dl className="help-shortcuts">
          {block.items.map((k, i) => {
            const acc = 'command' in k ? commandKeys(k.command) : k.keys
            const label = 'command' in k ? commandLabel(t, k.command) : k.label
            return (
              <div key={i}>
                <dt>{inline(label)}</dt>
                <dd>{acc ? <Keys accelerator={acc} /> : '–'}</dd>
              </div>
            )
          })}
        </dl>
      )
    case 'try':
      return (
        <p className="help-try">
          <button className="button primary" onClick={() => void invoke('help:run', block.command)}>
            {block.label}
          </button>
          {commandKeys(block.command) && <Keys accelerator={commandKeys(block.command)!} />}
        </p>
      )
  }
}

/** The command's name as the menu shows it. */
function commandLabel(t: (k: string) => string, id: string): string {
  const label = COMMANDS.find((c) => c.id === id)?.label
  return label ? t(label) : id
}
