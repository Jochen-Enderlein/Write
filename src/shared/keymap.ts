/**
 * Central keymap. The main process builds the menu bar from it (so shortcuts work natively),
 * and the renderer shows the same accelerators in the command palette.
 */
export type CommandId =
  | 'settings.open'
  | 'shortcuts.show'
  | 'page.new'
  | 'folder.new'
  | 'page.open'
  | 'palette.open'
  | 'search.fulltext'
  | 'sidebar.toggle'
  | 'journal.today'
  | 'page.rename'
  | 'page.trash'
  | 'page.favorite'
  | 'page.history'
  | 'page.info'
  | 'page.reveal'
  | 'page.move'
  | 'nav.back'
  | 'nav.forward'
  | 'template.insert'
  | 'vault.switch'
  | 'vault.open'
  | 'vault.create'
  | 'trash.show'
  | 'tags.show'
  | 'graph.show'
  | 'page.graph'
  | 'conflicts.show'
  | 'index.rebuild'
  | 'capture.open'
  | 'find.open'
  | 'find.replace'
  | 'find.next'
  | 'find.previous'
  | 'page.outline'
  | 'page.exportPdf'
  | 'page.exportHtml'
  | 'page.print'
  | 'page.icon'
  | 'page.newWindow'
  | 'journal.previous'
  | 'journal.next'
  | 'journal.calendar'
  | 'view.focus'
  | 'view.theme'
  | 'update.check'
  | 'help.whatsNew'

export interface CommandDef {
  id: CommandId
  /** i18n key for the label */
  label: string
  /** Electron accelerator */
  accelerator?: string
  menu: 'app' | 'file' | 'edit' | 'view' | 'go' | 'page' | 'help'
}

export const COMMANDS: CommandDef[] = [
  { id: 'update.check', label: 'cmd.checkUpdates', menu: 'app' },
  { id: 'settings.open', label: 'cmd.settings', accelerator: 'CmdOrCtrl+,', menu: 'app' },
  { id: 'page.new', label: 'cmd.pageNew', accelerator: 'CmdOrCtrl+N', menu: 'file' },
  { id: 'folder.new', label: 'cmd.folderNew', accelerator: 'CmdOrCtrl+Shift+N', menu: 'file' },
  { id: 'page.open', label: 'cmd.pageOpen', accelerator: 'CmdOrCtrl+P', menu: 'go' },
  { id: 'palette.open', label: 'cmd.palette', accelerator: 'CmdOrCtrl+K', menu: 'go' },
  { id: 'find.open', label: 'cmd.find', accelerator: 'CmdOrCtrl+F', menu: 'edit' },
  { id: 'find.replace', label: 'cmd.replace', accelerator: 'CmdOrCtrl+Alt+F', menu: 'edit' },
  { id: 'find.next', label: 'cmd.findNext', accelerator: 'CmdOrCtrl+G', menu: 'edit' },
  {
    id: 'find.previous',
    label: 'cmd.findPrevious',
    accelerator: 'CmdOrCtrl+Shift+G',
    menu: 'edit'
  },
  { id: 'search.fulltext', label: 'cmd.search', accelerator: 'CmdOrCtrl+Shift+F', menu: 'edit' },
  { id: 'sidebar.toggle', label: 'cmd.sidebar', accelerator: 'Control+CmdOrCtrl+S', menu: 'view' },
  { id: 'page.outline', label: 'cmd.outline', accelerator: 'Control+CmdOrCtrl+O', menu: 'view' },
  { id: 'view.focus', label: 'cmd.focus', accelerator: 'CmdOrCtrl+Shift+Enter', menu: 'view' },
  { id: 'view.theme', label: 'cmd.toggleTheme', menu: 'view' },
  { id: 'journal.today', label: 'cmd.journalToday', accelerator: 'CmdOrCtrl+Alt+J', menu: 'go' },
  {
    id: 'journal.previous',
    label: 'cmd.journalPrevious',
    accelerator: 'CmdOrCtrl+Alt+Up',
    menu: 'go'
  },
  { id: 'journal.next', label: 'cmd.journalNext', accelerator: 'CmdOrCtrl+Alt+Down', menu: 'go' },
  { id: 'journal.calendar', label: 'cmd.journalCalendar', menu: 'go' },
  { id: 'page.rename', label: 'cmd.pageRename', accelerator: 'CmdOrCtrl+Shift+R', menu: 'page' },
  {
    id: 'page.trash',
    label: 'cmd.pageTrash',
    accelerator: 'CmdOrCtrl+Alt+Backspace',
    menu: 'page'
  },
  { id: 'page.favorite', label: 'cmd.pageFavorite', accelerator: 'CmdOrCtrl+D', menu: 'page' },
  { id: 'page.history', label: 'cmd.pageHistory', accelerator: 'CmdOrCtrl+Shift+H', menu: 'page' },
  { id: 'page.info', label: 'cmd.pageInfo', accelerator: 'CmdOrCtrl+Alt+I', menu: 'page' },
  { id: 'page.reveal', label: 'cmd.pageReveal', accelerator: 'CmdOrCtrl+Shift+E', menu: 'page' },
  { id: 'page.icon', label: 'cmd.pageIcon', menu: 'page' },
  {
    id: 'page.newWindow',
    label: 'cmd.pageNewWindow',
    accelerator: 'CmdOrCtrl+Alt+N',
    menu: 'page'
  },
  { id: 'page.exportPdf', label: 'cmd.exportPdf', menu: 'page' },
  { id: 'page.exportHtml', label: 'cmd.exportHtml', menu: 'page' },
  { id: 'page.print', label: 'cmd.print', accelerator: 'CmdOrCtrl+Alt+P', menu: 'page' },
  { id: 'page.move', label: 'cmd.pageMove', accelerator: 'CmdOrCtrl+Shift+M', menu: 'page' },
  {
    id: 'template.insert',
    label: 'cmd.templateInsert',
    accelerator: 'CmdOrCtrl+Shift+T',
    menu: 'page'
  },
  { id: 'vault.switch', label: 'cmd.vaultSwitch', accelerator: 'CmdOrCtrl+Alt+O', menu: 'file' },
  { id: 'vault.open', label: 'cmd.vaultOpen', accelerator: 'CmdOrCtrl+Shift+O', menu: 'file' },
  { id: 'vault.create', label: 'cmd.vaultCreate', menu: 'file' },
  { id: 'nav.back', label: 'cmd.back', accelerator: 'CmdOrCtrl+[', menu: 'go' },
  { id: 'nav.forward', label: 'cmd.forward', accelerator: 'CmdOrCtrl+]', menu: 'go' },
  // No shortcut: ⇧⌘⌫ empties the trash in Finder, the muscle memory is too risky
  { id: 'trash.show', label: 'cmd.trash', menu: 'go' },
  { id: 'tags.show', label: 'cmd.tags', accelerator: 'Control+CmdOrCtrl+T', menu: 'go' },
  { id: 'graph.show', label: 'cmd.graph', accelerator: 'Control+CmdOrCtrl+G', menu: 'go' },
  { id: 'page.graph', label: 'cmd.pageGraph', menu: 'page' },
  { id: 'conflicts.show', label: 'cmd.conflicts', menu: 'go' },
  { id: 'index.rebuild', label: 'cmd.rebuildIndex', menu: 'file' },
  { id: 'capture.open', label: 'cmd.capture', menu: 'file' },
  { id: 'shortcuts.show', label: 'cmd.shortcuts', accelerator: 'CmdOrCtrl+/', menu: 'help' },
  { id: 'help.whatsNew', label: 'cmd.whatsNew', menu: 'help' }
]

/** Shortcuts handled by the editor itself (BlockNote/Tiptap); listed in the overview only. */
export const EDITOR_SHORTCUTS: { label: string; keys: string }[] = [
  { label: 'keys.bold', keys: 'CmdOrCtrl+B' },
  { label: 'keys.italic', keys: 'CmdOrCtrl+I' },
  { label: 'keys.strike', keys: 'CmdOrCtrl+Shift+S' },
  { label: 'keys.code', keys: 'CmdOrCtrl+E' },
  { label: 'keys.highlight', keys: 'Control+CmdOrCtrl+H' },
  { label: 'keys.heading', keys: 'CmdOrCtrl+Alt+1…6' },
  { label: 'keys.paragraph', keys: 'CmdOrCtrl+Alt+0' },
  { label: 'keys.bullet', keys: 'CmdOrCtrl+Shift+8' },
  { label: 'keys.numbered', keys: 'CmdOrCtrl+Shift+7' },
  { label: 'keys.todo', keys: 'CmdOrCtrl+Shift+9' },
  { label: 'keys.quote', keys: 'CmdOrCtrl+Alt+Q' },
  { label: 'keys.codeBlock', keys: 'CmdOrCtrl+Alt+C' },
  { label: 'keys.indent', keys: 'Tab' },
  { label: 'keys.outdent', keys: 'Shift+Tab' },
  { label: 'keys.undo', keys: 'CmdOrCtrl+Z' },
  { label: 'keys.redo', keys: 'CmdOrCtrl+Shift+Z' },
  { label: 'keys.slash', keys: '/' },
  { label: 'keys.wikilink', keys: '[[' },
  { label: 'keys.titleToEditor', keys: 'Enter' }
]

export const DEFAULT_CAPTURE_SHORTCUT = 'Control+Alt+Space'

/** Renders an Electron accelerator with macOS glyphs: `CmdOrCtrl+Shift+F` → `⇧⌘F` */
export function acceleratorGlyphs(acc: string | undefined, spaceLabel = 'Leertaste'): string {
  if (!acc) return ''
  const parts = acc.split('+')
  const key = parts.pop() ?? ''
  const order: [string, string][] = [
    ['Control', '⌃'],
    ['Alt', '⌥'],
    ['Shift', '⇧'],
    ['CmdOrCtrl', '⌘'],
    ['Command', '⌘']
  ]
  let s = ''
  for (const [name, glyph] of order) if (parts.includes(name)) s += glyph
  const keys: Record<string, string> = {
    Backspace: '⌫',
    Space: ' ' + spaceLabel,
    Up: '↑',
    Down: '↓',
    Left: '←',
    Right: '→',
    Enter: '↩',
    Tab: '⇥',
    '\\': '\\'
  }
  return s + (keys[key] ?? key.toUpperCase())
}
