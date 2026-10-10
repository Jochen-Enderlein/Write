import type { HelpContent } from './model'

export const en: HelpContent = {
  groups: {
    basics: 'Basics',
    connect: 'Connect',
    organize: 'Organize',
    blocks: 'Special Blocks',
    work: 'Work',
    safety: 'Safety',
    more: 'More'
  },

  examplePages: {
    'Project Apollo':
      '# Project Apollo\n\nLaunch is planned for July.\n\n## Goals\n\n- Finish the prototype\n- First tests with five people\n\n## Risks\n\nThe budget is tight. ^budget\n',
    Meeting: '# Meeting\n\nNotes from Monday.\n',
    Ideas: '# Ideas\n\nA loose collection.\n'
  },

  topics: {
    welcome: {
      title: 'How Write Works',
      summary:
        'Write is a block editor like Notion – but everything stays a plain Markdown file in a folder you own.',
      keywords: ['vault', 'folder', 'files', 'markdown', 'sync', 'icloud', 'dropbox', 'start'],
      blocks: [
        {
          kind: 'p',
          text: 'Your notes live in a **vault**: an ordinary folder on your Mac. Every page is a `.md` file, every subfolder a level in the page tree. Open the folder with other apps, search it, back it up – Write needs no server and no account.'
        },
        { kind: 'h', text: 'The files are the truth' },
        {
          kind: 'list',
          items: [
            'Write only reads and writes Markdown. Whatever the editor can’t show stays in the file **untouched**.',
            'Unchanged paragraphs are written back byte for byte – Write never quietly reformats your files.',
            'The search index and version history live separately in `~/Library/Application Support/Write` and can be rebuilt at any time.'
          ]
        },
        {
          kind: 'example',
          markdown:
            '# Welcome\n\nThis is **bold**, this is *italic* and this is ==highlighted==.\n\n- [ ] A task\n- [x] A finished task\n\nA link to [[Project Apollo]].\n',
          caption: 'Change the text and switch to “Markdown”: that’s what the file looks like.'
        },
        { kind: 'h', text: 'Syncing' },
        {
          kind: 'p',
          text: 'Put your vault in iCloud Drive, Dropbox or Nextcloud – Write notices changes from outside and reloads them. If two devices change the same page at once, see [Sync Conflicts](topic:conflicts).'
        },
        {
          kind: 'tip',
          text: 'Several vaults? {{cmd:vault.switch}} switches between them, {{cmd:vault.create}} creates a new one.'
        }
      ],
      related: ['pages', 'writing', 'markdown']
    },

    pages: {
      title: 'Pages & Folders',
      summary: 'Create pages, nest them, move them, keep favorites and find them again.',
      keywords: ['new', 'subpage', 'favorite', 'rename', 'move', 'page tree', 'folder'],
      blocks: [
        {
          kind: 'steps',
          items: [
            'Create a page with {{cmd:page.new}} or the **+** in the page tree. Its title is also its file name.',
            'Press **Return** in the title to jump into the text.',
            'Add subpages with the **+** next to a page. “Projects” then becomes `Projects.md` with a folder `Projects/` beside it.',
            'Drag pages and folders to a new place in the tree – or use {{cmd:page.move}}.'
          ]
        },
        {
          kind: 'keys',
          items: [
            { command: 'page.new' },
            { command: 'folder.new' },
            { command: 'page.open' },
            { command: 'page.rename' },
            { command: 'page.move' },
            { command: 'page.favorite' },
            { command: 'page.trash' },
            { command: 'nav.back' },
            { command: 'nav.forward' }
          ]
        },
        {
          kind: 'p',
          text: 'Clicking a **folder** shows its overview with all its pages – as cards or as a [table](topic:tables). A page’s context menu (right-click) also opens it in a new window or [beside](topic:split) the current one.'
        },
        {
          kind: 'tip',
          text: 'Renaming is safe: every link to the page is updated in all other pages.'
        },
        {
          kind: 'p',
          text: 'Write remembers where you were on a page: come back – with {{cmd:nav.back}}, say – and it is at the same spot, with the cursor where you left off.'
        },
        { kind: 'try', command: 'page.new', label: 'Create a page' }
      ],
      related: ['links', 'trash', 'search']
    },

    writing: {
      title: 'Writing in the Editor',
      summary:
        'Blocks, the slash menu, formatting and pasting – everything you need while writing.',
      keywords: [
        'slash',
        'block',
        'format',
        'bold',
        'italic',
        'list',
        'heading',
        'highlight',
        'paste',
        'quotes',
        'dash',
        'typography',
        'brackets',
        'url'
      ],
      blocks: [
        {
          kind: 'p',
          text: 'Every paragraph is a **block**. Type `/` at the start of a line to pick one: headings, lists, tasks, quotes, code, [callouts](topic:callouts), diagrams, [formulas](topic:math), [databases](topic:tables) and your [templates](topic:templates).'
        },
        {
          kind: 'p',
          text: 'Markdown shortcuts work as you type: `# ` becomes a heading, `- ` a list, `[] ` a task, `> ` a quote and `` ``` `` code.'
        },
        {
          kind: 'example',
          markdown:
            '## Try it here\n\nSelect a word – the formatting bar appears. Or type ==like this== for a highlight.\n\n1. First step\n2. Second step\n\n> A quote stays a quote.\n'
        },
        { kind: 'h', text: 'Formatting' },
        {
          kind: 'keys',
          items: [
            { keys: 'CmdOrCtrl+B', label: 'Bold' },
            { keys: 'CmdOrCtrl+I', label: 'Italic' },
            { keys: 'CmdOrCtrl+Shift+S', label: 'Strikethrough' },
            { keys: 'CmdOrCtrl+E', label: 'Inline code' },
            { keys: 'Control+CmdOrCtrl+H', label: 'Highlight' },
            { keys: 'CmdOrCtrl+Alt+1', label: 'Heading 1 (to 6)' },
            { keys: 'CmdOrCtrl+Shift+9', label: 'Task' },
            { keys: 'Tab', label: 'Indent' },
            { keys: 'Shift+Tab', label: 'Outdent' }
          ]
        },
        { kind: 'h', text: 'Moving blocks' },
        {
          kind: 'p',
          text: 'Hover to the left of a block: drag the **⋮⋮** handle to move it, or click it for the block menu – to delete the block or copy a [link to it](topic:blockrefs).'
        },
        { kind: 'h', text: 'While typing' },
        {
          kind: 'list',
          items: [
            '**Smart punctuation:** `"hi"` becomes “hi”, `it\'s` becomes it’s, `word -- word` gets an en dash and `...` an ellipsis. **⌫** right after takes it back. Code stays exactly as typed; turn it off in [Settings](topic:settings).',
            '**Wrap a selection:** select text and type `(`, `[`, `{` or `"` – the text is wrapped instead of replaced. Typing `[` twice turns the selection into a [link](topic:links).',
            '**Paste a link:** copy an address, select text and paste with {{keys:CmdOrCtrl+V}} – the text becomes a link.'
          ]
        },
        {
          kind: 'example',
          markdown: 'Select a word and type [ twice – or type "quotes" here.\n'
        },
        {
          kind: 'tip',
          text: 'Text pasted from the browser, from chats or other editors arrives formatted – Markdown is always recognized.'
        },
        {
          kind: 'note',
          text: 'Colors, underline and text alignment are left out on purpose: Markdown can’t store them, and Write keeps your files clean.'
        }
      ],
      related: ['markdown', 'callouts', 'code']
    },

    markdown: {
      title: 'Markdown Mode',
      summary: 'Edit a page as plain Markdown – on its own or with a live preview beside it.',
      keywords: ['source', 'preview', 'mode', 'raw'],
      blocks: [
        {
          kind: 'p',
          text: 'Write shows a page in three ways. Switch in the toolbar at the top right, or with the keyboard:'
        },
        {
          kind: 'keys',
          items: [
            { command: 'view.modeRich' },
            { command: 'view.modeMarkdown' },
            { command: 'view.modeSplit' }
          ]
        },
        {
          kind: 'list',
          items: [
            '**Formatted** – the block editor, as usual.',
            '**Markdown** – the text exactly as it is in the file, with syntax colors.',
            '**Markdown with Preview** – write on the left, see the result on the right. The preview scrolls along.'
          ]
        },
        {
          kind: 'p',
          text: 'In Markdown mode too, `[[links]]` and `#tags` are completed as you type.'
        },
        {
          kind: 'note',
          text: 'Whatever the block editor doesn’t know – such as HTML or reference links – appears as a gray “Markdown” block. Double-click it to edit it as text.'
        },
        { kind: 'try', command: 'view.modeSplit', label: 'Show Markdown with preview' }
      ],
      related: ['writing', 'welcome']
    },

    links: {
      title: 'Links & Backlinks',
      summary: 'Connect pages with [[wiki links]] and see who points to a page.',
      keywords: ['wikilink', 'link', 'backlink', 'mention', 'section', 'alias', 'reference'],
      blocks: [
        {
          kind: 'steps',
          items: [
            'Type `[[` – a list of your pages appears.',
            'Pick a page or type a new title: clicking a link to a page that doesn’t exist yet creates it.',
            'Click a link to open the page; **⌘-click** opens it [beside](topic:split) the current one.',
            'Rest the pointer on a link for a moment and a **preview** shows the start of the page – without opening it.'
          ]
        },
        {
          kind: 'example',
          markdown:
            'See [[Project Apollo]], especially [[Project Apollo#Goals]].\n\nWith your own text: [[Project Apollo|our big project]].\n\nMissing pages are underlined with dashes: [[Does not exist yet]].\n'
        },
        {
          kind: 'list',
          items: [
            '`[[Page]]` – to a page',
            '`[[Page#Heading]]` – to a section',
            '`[[Page#^id]]` – to a single block, see [Block References](topic:blockrefs)',
            '`[[Page|Text]]` – with your own link text',
            '`[[Folder/Page]]` – unambiguous when several pages share a name'
          ]
        },
        { kind: 'h', text: 'Backlinks' },
        {
          kind: 'p',
          text: 'Below every page, **Linked from** lists all pages that point here, with the sentence around the link.'
        },
        { kind: 'h', text: 'Unlinked mentions' },
        {
          kind: 'p',
          text: 'Below that you’ll find pages that mention the title only as text. **Link** turns the mention into a real link – and can be undone.'
        }
      ],
      related: ['blockrefs', 'embeds', 'graph']
    },

    blockrefs: {
      title: 'Block References',
      summary: 'Link not just to pages, but to a single paragraph or list item.',
      keywords: ['block', 'paragraph', '^', 'id', 'reference', 'copy link'],
      blocks: [
        {
          kind: 'p',
          text: 'A block gets an id by ending with ` ^id`. A link `[[Page#^id]]` then jumps right there, and `![[Page#^id]]` shows just that block. The format is the same as in Obsidian.'
        },
        {
          kind: 'steps',
          items: [
            'Hover to the left of the block and click the **⋮⋮** handle.',
            'Choose **Copy link to block**. Write adds an id to the block if it has none yet.',
            'Paste the link anywhere – done.'
          ]
        },
        {
          kind: 'p',
          text: 'Or put the cursor in the block and choose **Copy Link to Block** from the _Page_ menu. That works in [Markdown mode](topic:markdown) too.'
        },
        {
          kind: 'example',
          markdown:
            'The budget is tight, says [[Project Apollo#^budget]].\n\n![[Project Apollo#^budget]]\n\nThis sentence has an id of its own. ^my-sentence\n',
          caption: 'The id at the end is shown small and gray; exports leave it out.'
        },
        {
          kind: 'tip',
          text: 'List items take their sub-items along. Code blocks, tables and quotes get the id as a line `^id` of its own below them.'
        }
      ],
      related: ['links', 'embeds']
    },

    embeds: {
      title: 'Embeds',
      summary: 'Bring other pages, sections or images right into a page.',
      keywords: ['embed', 'transclusion', 'image', '![['],
      blocks: [
        {
          kind: 'p',
          text: 'An exclamation mark in front of a link embeds instead of linking. The embedded page stays a preview – you edit it where it lives; clicking its title opens it.'
        },
        {
          kind: 'example',
          markdown: 'The project’s goals:\n\n![[Project Apollo#Goals]]\n'
        },
        {
          kind: 'list',
          items: [
            '`![[Page]]` – the whole page',
            '`![[Page#Section]]` – just one section',
            '`![[Page#^id]]` – just one [block](topic:blockrefs)',
            '`![[Image.png]]` – an image from the vault; `![[Image.png|300]]` 300 pixels wide'
          ]
        },
        {
          kind: 'tip',
          text: 'Just drag images into a page. Write keeps them next to the page in a folder `_assets`.'
        }
      ],
      related: ['links', 'blockrefs']
    },

    tags: {
      title: 'Tags',
      summary: 'Organize pages across folders with #tags – nested if you like.',
      keywords: ['tag', 'hashtag', 'label', 'nested', 'rename'],
      blocks: [
        {
          kind: 'p',
          text: 'Write `#tag` anywhere in the text, or add tags below the title. Nest them with `/`: `#project/write` belongs to `#project`, and searching for `#project` finds both.'
        },
        {
          kind: 'example',
          markdown: 'Notes on #project/write and #idea – tags are recognized as you type.\n'
        },
        {
          kind: 'p',
          text: 'The tag overview ({{cmd:tags.show}}) shows all tags as a tree. There you can **rename a tag in every page at once**.'
        },
        { kind: 'try', command: 'tags.show', label: 'Open the tag overview' }
      ],
      related: ['search', 'properties', 'graph']
    },

    graph: {
      title: 'Graph',
      summary: 'Your pages as solar systems in 3D – see what belongs together.',
      keywords: ['graph', 'network', 'connections', '3d', 'solar system', 'map'],
      blocks: [
        {
          kind: 'list',
          items: [
            'The **global graph** ({{cmd:graph.show}}) shows each group of closely linked pages as a solar system of its own. Pages without links orbit in the asteroid belt.',
            'A page’s **local graph** (button at the top right) shows it as the sun, its links as planets and moons.',
            'Tags appear as golden bodies.'
          ]
        },
        {
          kind: 'p',
          text: 'Click to select, double-click to open the page. Jump to a page with the search field; **Centre** makes it the sun.'
        },
        { kind: 'try', command: 'graph.show', label: 'Show the graph' }
      ],
      related: ['links', 'tags']
    },

    properties: {
      title: 'Properties',
      summary: 'Status, due date, client, budget – structured details for every page.',
      keywords: ['property', 'frontmatter', 'yaml', 'metadata', 'status', 'field'],
      blocks: [
        {
          kind: 'steps',
          items: [
            'Click **+ Property** below the title.',
            'Type a name – names used on neighboring pages are suggested.',
            'Pick the type and enter the value.'
          ]
        },
        {
          kind: 'list',
          items: [
            '**Text** and **Number**',
            '**Date** – with a calendar',
            '**Checkbox** – yes or no',
            '**Page link** – points to another page',
            '**List** – several values, such as people involved'
          ]
        },
        {
          kind: 'p',
          text: 'Everything is stored in the **frontmatter** at the top of the file, as plain YAML:'
        },
        {
          kind: 'example',
          markdown:
            '```yaml\n---\ntitle: Website relaunch\nstatus: In progress\ndue: 2026-11-15\nbudget: 12000\nclient: "[[Project Apollo]]"\n---\n```\n',
          caption:
            'That’s how it reads at the top of the file; in Write you see a tidy form instead.'
        },
        {
          kind: 'tip',
          text: 'Properties shine in [tables](topic:tables): sort, filter and edit them right there.'
        }
      ],
      related: ['tables', 'tasks']
    },

    tables: {
      title: 'Tables & Databases',
      summary:
        'See a folder’s pages as a table, filter and edit them – even in the middle of a page.',
      keywords: ['table', 'database', 'filter', 'sort', 'columns', 'write-table'],
      blocks: [
        { kind: 'h', text: 'A folder as a table' },
        {
          kind: 'p',
          text: 'Open a folder and switch from **Cards** to **Table** at the top right. Every page is a row, every [property](topic:properties) a column. Edit cells directly and add new pages at the bottom.'
        },
        {
          kind: 'list',
          items: [
            'Click a column header to sort or hide it.',
            '**+ Filter**: conditions like “is”, “contains”, “is empty”, “before” and “after”.',
            '**Columns**: choose and arrange what you want to see.'
          ]
        },
        { kind: 'h', text: 'A database inside a page' },
        {
          kind: 'p',
          text: 'Type `/Database` – a table appears in the middle of the page, at first with this page’s subpages. Use `</>` to choose which folder it shows. Behind it is a small YAML block:'
        },
        {
          kind: 'example',
          markdown:
            '```yaml\nfrom: Projects\ncolumns: [status, due]\nsort: [{ key: due, dir: asc }]\nfilter: [{ key: status, op: isNot, value: Done }]\n```\n',
          caption:
            'The settings of an embedded table, as they appear in the `write-table` code block.'
        },
        {
          kind: 'tip',
          text: 'Date filters understand `today`, `tomorrow`, `yesterday` and offsets like `today+7` – so a table always shows what’s due this week.'
        }
      ],
      related: ['properties', 'tasks']
    },

    tasks: {
      title: 'Tasks & Due Dates',
      summary: 'To-dos in any page – and a list of every open task in the whole vault.',
      keywords: ['task', 'todo', 'to-do', 'checkbox', 'due', 'done'],
      blocks: [
        {
          kind: 'p',
          text: 'A task is a list item with a box: `- [ ]` or {{keys:CmdOrCtrl+Shift+9}}. Add a due date as `📅 2026-10-20` after it, as in Obsidian.'
        },
        {
          kind: 'example',
          markdown:
            '- [ ] Send the quote 📅 2026-10-20\n- [ ] Prepare the presentation\n- [x] Schedule the meeting\n'
        },
        { kind: 'h', text: 'Every task at a glance' },
        {
          kind: 'p',
          text: 'Type `/Tasks` – a table gathers every open to-do from your notes, sorted by due date. Overdue ones are red. **Checking one off in the table checks it off in the note.**'
        }
      ],
      related: ['tables', 'journal']
    },

    journal: {
      title: 'Journal & Calendar',
      summary: 'One page per day – for notes, thoughts and everything that belongs nowhere else.',
      keywords: ['journal', 'diary', 'daily', 'today', 'calendar', 'date'],
      blocks: [
        {
          kind: 'p',
          text: '{{cmd:journal.today}} or **Today** in the sidebar opens the day’s page. It lives in the vault as `Journal/2026-10-09.md`.'
        },
        {
          kind: 'keys',
          items: [
            { command: 'journal.today' },
            { command: 'journal.previous' },
            { command: 'journal.next' }
          ]
        },
        {
          kind: 'p',
          text: 'Every journal page shows the day in words, arrows to the previous and next entry, and a **calendar** that marks days with entries.'
        },
        {
          kind: 'tip',
          text: 'With [Quick Capture](topic:capture), a thought lands in today’s journal from any app – without opening Write.'
        },
        { kind: 'try', command: 'journal.today', label: 'Open today’s journal' }
      ],
      related: ['capture', 'templates']
    },

    templates: {
      title: 'Templates',
      summary: 'Create recurring pages such as meetings or projects in one go.',
      keywords: ['template', 'placeholder', 'meeting'],
      blocks: [
        {
          kind: 'p',
          text: 'Templates are ordinary Markdown files in your vault’s `.docuapp/templates` folder. Write starts you off with a meeting and a project template – change them or add your own.'
        },
        {
          kind: 'list',
          items: [
            '`{{title}}` – the page’s title',
            '`{{date}}` and `{{time}}` – date and time',
            '`{{weekday}}` – the day of the week'
          ]
        },
        {
          kind: 'p',
          text: 'Insert one with {{cmd:template.insert}}, or type `/` and the template’s name. The command palette also offers **New page from template**.'
        },
        {
          kind: 'example',
          markdown:
            '# {{title}}\n\n**Date:** {{date}} · {{time}}\n\n## Topics\n\n1. \n\n## Tasks\n\n- [ ] \n',
          caption: 'Part of the bundled meeting template.'
        }
      ],
      related: ['journal', 'pages']
    },

    callouts: {
      title: 'Callouts',
      summary: 'Notes, tips and warnings that stand out from the text.',
      keywords: ['callout', 'note', 'warning', 'tip', 'box', 'admonition'],
      blocks: [
        {
          kind: 'p',
          text: 'Type `/Callout` or write `> [!note]` at the start of a line. Choose the kind with the symbol on the left; the title is optional.'
        },
        {
          kind: 'example',
          markdown:
            '> [!tip] Good to know\n> Callouts are ordinary quotes with a marker.\n\n> [!warning]\n> Careful, this one matters.\n'
        },
        {
          kind: 'p',
          text: 'Kinds: `note`, `info`, `tip`, `success`, `question`, `warning`, `danger`, `important`, `caution`, `todo`, `example` and `quote` – compatible with Obsidian and GitHub.'
        }
      ],
      related: ['writing', 'code']
    },

    code: {
      title: 'Code & Diagrams',
      summary: 'Code with syntax colors, and Mermaid diagrams that take shape as you type.',
      keywords: ['code', 'program', 'syntax', 'mermaid', 'diagram', 'flowchart', 'indent'],
      blocks: [
        {
          kind: 'p',
          text: 'Three backticks `` ``` `` or `/Code` start a code block. Pick the language at the top of the block. **Tab** and **⇧Tab** indent and outdent the selected lines; Return keeps the indentation.'
        },
        {
          kind: 'example',
          markdown: '```ts\nfunction greet(name: string) {\n  return `Hello ${name}`\n}\n```\n'
        },
        { kind: 'h', text: 'Mermaid diagrams' },
        {
          kind: 'p',
          text: '`/Mermaid` adds a diagram. `</>` or a double-click opens its code beside it; the diagram updates as you type, and **Escape** folds the code away again.'
        },
        {
          kind: 'example',
          markdown: '```mermaid\ngraph LR\n  Idea --> Draft --> Done\n```\n'
        }
      ],
      related: ['math', 'writing']
    },

    math: {
      title: 'Formulas',
      summary: 'Math in the text and as a block of its own, typeset with LaTeX.',
      keywords: ['formula', 'math', 'latex', 'katex', 'equation'],
      blocks: [
        {
          kind: 'list',
          items: [
            '`$E = mc^2$` – a formula in the middle of a sentence.',
            '`$$ … $$` – a formula as a block of its own.',
            'In the slash menu: **Formula** and **Inline formula**.'
          ]
        },
        {
          kind: 'example',
          markdown: 'Einstein wrote $E = mc^2$.\n\n$$\n\\int_0^1 x^2 \\, dx = \\frac{1}{3}\n$$\n',
          caption: 'Click a formula to edit its LaTeX.'
        }
      ],
      related: ['code', 'footnotes']
    },

    footnotes: {
      title: 'Footnotes',
      summary: 'Remarks that don’t interrupt the reading.',
      keywords: ['footnote', 'note', 'source', 'reference'],
      blocks: [
        {
          kind: 'p',
          text: 'Type `/Footnote`: Write adds a superscript number and puts the note at the end of the page. Clicking the number jumps to the note.'
        },
        {
          kind: 'example',
          markdown:
            'Write stores everything as Markdown.[^1]\n\n[^1]: More precisely: CommonMark with a few common extensions.\n'
        }
      ],
      related: ['math', 'writing']
    },

    split: {
      title: 'Split View',
      summary: 'Two pages side by side – research on the left, write on the right.',
      keywords: ['split', 'side by side', 'two pages', 'beside', 'column'],
      blocks: [
        {
          kind: 'steps',
          items: [
            'Open split view with {{cmd:view.splitPane}} or the button with two rectangles at the top right. The page you opened before appears on the right.',
            'Or open a specific page beside: **⌘-click** a link, a backlink or a favorite – or choose **Open Beside** in the page tree’s context menu.',
            'Drag the divider to change the width. Double-click it to split evenly again.'
          ]
        },
        {
          kind: 'p',
          text: 'The half you clicked last is **active**: the page tree and the command palette open pages there, and commands like rename or find act on it. The other half’s title fades a little.'
        },
        {
          kind: 'list',
          items: [
            'The toolbar, outline and page info belong to the left page.',
            'The arrow in the right header moves the page to the left; ✕ closes the right page.',
            'With the same page open on both sides, every change shows up on both right away.'
          ]
        },
        { kind: 'try', command: 'view.splitPane', label: 'Open split view' }
      ],
      related: ['links', 'focus']
    },

    search: {
      title: 'Search & Command Palette',
      summary: 'Find pages, text and commands without leaving the keyboard.',
      keywords: ['search', 'find', 'full text', 'palette', 'command', 'replace', 'quick open'],
      blocks: [
        {
          kind: 'keys',
          items: [
            { command: 'palette.open' },
            { command: 'page.open' },
            { command: 'search.fulltext' },
            { command: 'find.open' },
            { command: 'find.replace' },
            { command: 'find.next' }
          ]
        },
        {
          kind: 'list',
          items: [
            '**Command palette** – open pages, create new ones, run any command. At the very bottom: a full-text search for what you typed.',
            '**Full-text search** – searches every page, tags included. A hit opens the page with the matches marked.',
            '**Find and replace** – in the open page, optionally case-sensitive.'
          ]
        },
        { kind: 'try', command: 'palette.open', label: 'Open the command palette' }
      ],
      related: ['tags', 'pages']
    },

    focus: {
      title: 'Focus Mode & Outline',
      summary: 'Hide everything but the text – or keep track of long pages.',
      keywords: ['focus', 'distraction', 'outline', 'table of contents', 'words'],
      blocks: [
        {
          kind: 'p',
          text: '**Focus mode** ({{cmd:view.focus}}) hides the sidebar and toolbar and dims every paragraph except the one you’re writing in. The line you’re typing stays in the middle of the window, like on a typewriter.'
        },
        {
          kind: 'p',
          text: 'The **outline** ({{cmd:page.outline}}) lists the page’s headings on the right. Click one to jump there; the section you’re reading is highlighted.'
        },
        {
          kind: 'p',
          text: 'The page’s word count is in the toolbar; page info ({{cmd:page.info}}) shows more.'
        },
        { kind: 'try', command: 'view.focus', label: 'Turn on focus mode' }
      ],
      related: ['split', 'settings']
    },

    capture: {
      title: 'Quick Capture',
      summary: 'Catch a thought from any app – with one keystroke.',
      keywords: ['capture', 'quick', 'note', 'inbox', 'global', 'shortcut'],
      blocks: [
        {
          kind: 'steps',
          items: [
            'Press {{keys:Control+Alt+Space}} – whichever app you’re in.',
            'Type your thought into the small window.',
            '**Return** saves it to today’s [journal](topic:journal), **⇧Return** starts a new line, **Escape** closes.'
          ]
        },
        {
          kind: 'tip',
          text: 'Change the shortcut in Settings under **Quick Capture**.'
        },
        { kind: 'try', command: 'capture.open', label: 'Open Quick Capture' }
      ],
      related: ['journal', 'settings']
    },

    share: {
      title: 'Sharing & Export',
      summary: 'Pass on a page or an excerpt as Markdown, PDF or HTML.',
      keywords: ['share', 'export', 'pdf', 'html', 'print', 'airdrop', 'mail', 'copy'],
      blocks: [
        {
          kind: 'p',
          text: 'The **Share** button at the top right passes the page on via Mail, Messages, AirDrop and more – as Markdown, PDF or HTML. With text selected, only the excerpt is shared.'
        },
        {
          kind: 'list',
          items: [
            '**Copy as Markdown** – for chats, tickets or other editors.',
            'In the _Page_ menu: **Export as PDF**, **Export as HTML** and **Print** ({{cmd:page.print}}).'
          ]
        },
        {
          kind: 'note',
          text: 'Exports are always light, even in dark mode – so they print and look good anywhere.'
        }
      ],
      related: ['markdown', 'history']
    },

    history: {
      title: 'Version History',
      summary: 'Every page has a history – look at earlier states, compare them, bring them back.',
      keywords: ['version', 'history', 'snapshot', 'restore', 'undo', 'backup'],
      blocks: [
        {
          kind: 'p',
          text: 'After a short pause in typing (4 seconds by default) Write records a version automatically. You never need to save.'
        },
        {
          kind: 'steps',
          items: [
            'Open the version history with {{cmd:page.history}} or the clock at the top right.',
            'Pick a state on the left – on the right you see how it differs from the current version.',
            '**Restore This Version** brings it back. That becomes a version too, so nothing is lost.'
          ]
        },
        {
          kind: 'p',
          text: 'The history lives outside the vault (in a local Git archive) and isn’t synced. How long it’s kept is up to you in [Settings](topic:settings).'
        }
      ],
      related: ['trash', 'conflicts']
    },

    conflicts: {
      title: 'Sync Conflicts',
      summary: 'When two devices change the same page at once, you decide which one wins.',
      keywords: [
        'conflict',
        'sync',
        'icloud',
        'dropbox',
        'nextcloud',
        'conflicted copy',
        'external'
      ],
      blocks: [
        { kind: 'h', text: 'Changes from outside' },
        {
          kind: 'p',
          text: 'If a page changes on disk while you edit it, a notice appears at the top. **Compare** shows both versions side by side; then choose **Load External Version** or **Save My Version** – which can be undone, too.'
        },
        { kind: 'h', text: 'Conflict copies' },
        {
          kind: 'p',
          text: 'Some sync services create a copy when changes collide, such as “Page (conflicted copy …).md”. Write recognizes them and lists them under **Conflicts** ({{cmd:conflicts.show}}): **Keep Mine**, **Use Conflict Copy** or **Keep Both**.'
        },
        {
          kind: 'tip',
          text: 'When in doubt, nothing is lost: every version Write saved is also in the [version history](topic:history).'
        }
      ],
      related: ['history', 'welcome']
    },

    trash: {
      title: 'Trash',
      summary: 'Deleted pages go to the trash first – and come back from there.',
      keywords: ['trash', 'delete', 'restore', 'deleted', 'bin'],
      blocks: [
        {
          kind: 'list',
          items: [
            'Delete with {{cmd:page.trash}} or from the context menu. Right afterwards, a notice offers **Undo**.',
            'The **Trash** in the sidebar lists everything deleted – **Restore** puts it back where it was.',
            'After 30 days it’s emptied for good. Change that in [Settings](topic:settings), even to “Never”.'
          ]
        },
        {
          kind: 'p',
          text: 'The trash is a folder `.trash` in the vault, so it syncs along.'
        },
        { kind: 'try', command: 'trash.show', label: 'Open the trash' }
      ],
      related: ['history', 'pages']
    },

    ai: {
      title: 'AI Assistants',
      summary:
        'Claude, OpenCode and others can search and read your vault – and edit it if you want.',
      keywords: ['ai', 'claude', 'mcp', 'assistant', 'opencode', 'chatgpt', 'llm'],
      blocks: [
        {
          kind: 'p',
          text: 'Write speaks the **Model Context Protocol (MCP)**. With it, an AI assistant can work with your notes – search, read, filter by properties, list open tasks and, if you allow it, create and change pages.'
        },
        {
          kind: 'steps',
          items: [
            'Open [Settings](topic:settings) ({{cmd:settings.open}}) and go to **AI Assistants**.',
            'Choose **Read only** or **Read and write**.',
            'Copy the configuration shown into your assistant – for Claude Desktop, Claude Code in the terminal or OpenCode, it says where.'
          ]
        },
        {
          kind: 'note',
          text: 'What the assistant reads goes to its provider. Every change it makes lands in the [version history](topic:history) and can be undone there.'
        },
        { kind: 'try', command: 'settings.open', label: 'Open Settings' }
      ],
      related: ['settings', 'history']
    },

    shortcuts: {
      title: 'Keyboard Shortcuts',
      summary: 'The most important shortcuts – and where to find them all.',
      keywords: ['keyboard', 'shortcut', 'key', 'hotkey'],
      blocks: [
        {
          kind: 'keys',
          items: [
            { command: 'palette.open' },
            { command: 'page.new' },
            { command: 'page.open' },
            { command: 'search.fulltext' },
            { command: 'journal.today' },
            { command: 'view.splitPane' },
            { command: 'sidebar.toggle' },
            { command: 'view.focus' },
            { command: 'page.history' },
            { command: 'help.open' }
          ]
        },
        {
          kind: 'p',
          text: 'Every shortcut – the editor’s too – is in the overview {{cmd:shortcuts.show}}, with a search field.'
        },
        { kind: 'try', command: 'shortcuts.show', label: 'Show all shortcuts' }
      ],
      related: ['search', 'writing']
    },

    settings: {
      title: 'Settings',
      summary: 'Font, line width, appearance, vaults and what Write does in the background.',
      keywords: [
        'settings',
        'preferences',
        'font',
        'dark',
        'light',
        'theme',
        'width',
        'language',
        'updates'
      ],
      blocks: [
        {
          kind: 'list',
          items: [
            '**Appearance** – font (System, Serif, Monospace), font size, line width, smart punctuation and light/dark. The accent color follows macOS.',
            '**Language** – German or English, or the same as the system.',
            '**Vaults** – open vaults, show them in the Finder, remove them from the list.',
            '**Quick Capture** – the shortcut that takes a note from any app.',
            '**Data** – when the trash is emptied, when versions are taken and how long they’re kept; rebuild the search index.',
            '**AI Assistants** – see [AI Assistants](topic:ai).',
            '**About Write** – version, license, privacy and updates.'
          ]
        },
        {
          kind: 'p',
          text: 'You can also flip between light and dark with _View → Toggle Light/Dark View_.'
        },
        { kind: 'try', command: 'settings.open', label: 'Open Settings' }
      ],
      related: ['ai', 'focus']
    }
  }
}
