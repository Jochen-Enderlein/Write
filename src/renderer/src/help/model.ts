import type { CommandId } from '@shared/keymap'

/**
 * The help's structure: groups and topics in sidebar order. What a topic says lives per language
 * in `content.de.ts` / `content.en.ts`; both must cover every topic (the type checks it).
 *
 * Inline text knows a few marks:
 *  - `**fett**` and `` `code` ``
 *  - `{{cmd:page.new}}` – the shortcut of a command, read from the keymap, as key caps
 *  - `{{keys:CmdOrCtrl+B}}` – any accelerator as key caps
 *  - `[Text](topic:links)` – a link to another topic
 */
export const HELP_GROUPS = [
  { id: 'basics', topics: ['welcome', 'pages', 'writing', 'markdown'] },
  { id: 'connect', topics: ['links', 'blockrefs', 'embeds', 'tags', 'graph'] },
  { id: 'organize', topics: ['properties', 'tables', 'tasks', 'journal', 'templates'] },
  { id: 'blocks', topics: ['callouts', 'code', 'math', 'footnotes'] },
  { id: 'work', topics: ['split', 'search', 'focus', 'capture', 'share'] },
  { id: 'safety', topics: ['history', 'conflicts', 'trash'] },
  { id: 'more', topics: ['ai', 'shortcuts', 'settings'] }
] as const

export type HelpGroupId = (typeof HELP_GROUPS)[number]['id']
export type HelpTopicId = (typeof HELP_GROUPS)[number]['topics'][number]

export const HELP_TOPICS: HelpTopicId[] = HELP_GROUPS.flatMap((g) => [...g.topics])

export function isHelpTopic(id: string | null | undefined): id is HelpTopicId {
  return Boolean(id) && (HELP_TOPICS as string[]).includes(id!)
}

export type HelpBlock =
  /** A paragraph. */
  | { kind: 'p'; text: string }
  /** A sub heading inside a topic. */
  | { kind: 'h'; text: string }
  /** Numbered steps ("So geht's"). */
  | { kind: 'steps'; items: string[] }
  /** A plain bullet list. */
  | { kind: 'list'; items: string[] }
  /** A hint box: a tip, or something to keep in mind. */
  | { kind: 'tip' | 'note'; text: string }
  /**
   * A live example: a real editor with this Markdown, editable but never saved. The reader can
   * switch to the Markdown that ends up in the file.
   */
  | { kind: 'example'; markdown: string; caption?: string }
  /** Shortcuts as a table: a command from the keymap, or fixed keys with a label. */
  | { kind: 'keys'; items: ({ command: CommandId } | { keys: string; label: string })[] }
  /** A button that runs the command in the main window. */
  | { kind: 'try'; command: CommandId; label: string }

export interface HelpTopic {
  title: string
  /** One sentence under the title: what the topic is good for. */
  summary: string
  /** Extra words the search should find the topic by. */
  keywords?: string[]
  blocks: HelpBlock[]
  related?: HelpTopicId[]
}

export interface HelpContent {
  groups: Record<HelpGroupId, string>
  topics: Record<HelpTopicId, HelpTopic>
  /**
   * Pages the examples' `![[…]]` embeds and `[[…]]` links resolve to; keyed by title, text is
   * Markdown.
   */
  examplePages: Record<string, string>
}
