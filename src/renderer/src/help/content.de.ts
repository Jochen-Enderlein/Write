import type { HelpContent } from './model'

export const de: HelpContent = {
  groups: {
    basics: 'Grundlagen',
    connect: 'Verknüpfen',
    organize: 'Organisieren',
    blocks: 'Besondere Blöcke',
    work: 'Arbeiten',
    safety: 'Sicherheit',
    more: 'Mehr'
  },

  examplePages: {
    'Projekt Apollo':
      '# Projekt Apollo\n\nDer Start ist für Juli geplant.\n\n## Ziele\n\n- Prototyp fertigstellen\n- Erste Tests mit fünf Personen\n\n## Risiken\n\nDas Budget ist knapp. ^budget\n',
    Besprechung: '# Besprechung\n\nNotizen vom Montag.\n',
    Ideen: '# Ideen\n\nEine lose Sammlung.\n'
  },

  topics: {
    welcome: {
      title: 'So funktioniert Write',
      summary:
        'Write ist ein Blockeditor wie Notion – aber alles bleibt eine normale Markdown-Datei in einem Ordner, der dir gehört.',
      keywords: ['vault', 'ordner', 'dateien', 'markdown', 'sync', 'icloud', 'dropbox', 'start'],
      blocks: [
        {
          kind: 'p',
          text: 'Deine Notizen liegen in einem **Vault**: einem ganz normalen Ordner auf deinem Mac. Jede Seite ist eine `.md`-Datei, jeder Unterordner eine Ebene im Seitenbaum. Du kannst den Ordner mit anderen Apps öffnen, durchsuchen und sichern – Write braucht keinen Server und kein Konto.'
        },
        { kind: 'h', text: 'Die Dateien sind die Wahrheit' },
        {
          kind: 'list',
          items: [
            'Write liest und schreibt nur Markdown. Was der Editor nicht darstellen kann, bleibt **unverändert** in der Datei stehen.',
            'Unveränderte Absätze werden Byte für Byte zurückgeschrieben – Write formatiert deine Dateien nicht heimlich um.',
            'Suchindex und Versionsgeschichte liegen getrennt unter `~/Library/Application Support/Write` und lassen sich jederzeit neu aufbauen.'
          ]
        },
        {
          kind: 'example',
          markdown:
            '# Willkommen\n\nDas hier ist **fett**, das *kursiv* und das ==markiert==.\n\n- [ ] Eine Aufgabe\n- [x] Eine erledigte Aufgabe\n\nEin Link auf [[Projekt Apollo]].\n',
          caption: 'Ändere den Text und schalte auf „Markdown“: So sieht die Datei dazu aus.'
        },
        { kind: 'h', text: 'Synchronisieren' },
        {
          kind: 'p',
          text: 'Leg den Vault in iCloud Drive, Dropbox oder Nextcloud – Write merkt Änderungen von außen und lädt sie neu. Wenn zwei Geräte gleichzeitig dieselbe Seite ändern, hilft dir [Sync-Konflikte](topic:conflicts).'
        },
        {
          kind: 'tip',
          text: 'Mehrere Vaults? Mit {{cmd:vault.switch}} wechselst du zwischen ihnen, mit {{cmd:vault.create}} legst du einen neuen an.'
        }
      ],
      related: ['pages', 'writing', 'markdown']
    },

    pages: {
      title: 'Seiten & Ordner',
      summary: 'Seiten anlegen, verschachteln, verschieben, als Favorit merken und wiederfinden.',
      keywords: [
        'neu',
        'unterseite',
        'favorit',
        'umbenennen',
        'verschieben',
        'seitenbaum',
        'ordner'
      ],
      blocks: [
        {
          kind: 'steps',
          items: [
            'Neue Seite mit {{cmd:page.new}} oder dem **+** im Seitenbaum. Der Titel ist zugleich der Dateiname.',
            'Mit **Enter** im Titel springst du in den Text.',
            'Unterseiten legst du über das **+** neben einer Seite an. Aus „Projekte“ wird dann `Projekte.md` mit einem Ordner `Projekte/` daneben.',
            'Seiten und Ordner ziehst du im Baum an ihren neuen Platz – oder du nutzt {{cmd:page.move}}.'
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
          text: 'Ein Klick auf einen **Ordner** zeigt seine Übersicht mit allen Seiten – als Karten oder als [Tabelle](topic:tables). Über das Kontextmenü (Rechtsklick) einer Seite kannst du sie auch in einem neuen Fenster oder [daneben](topic:split) öffnen.'
        },
        {
          kind: 'tip',
          text: 'Umbenennen ist sicher: Alle Links auf die Seite werden in allen anderen Seiten mit angepasst.'
        },
        {
          kind: 'p',
          text: 'Write merkt sich, wo du auf einer Seite warst: Kehrst du zurück – etwa mit {{cmd:nav.back}} –, steht sie an derselben Stelle, und der Cursor wartet dort, wo du aufgehört hast.'
        },
        { kind: 'try', command: 'page.new', label: 'Neue Seite anlegen' }
      ],
      related: ['links', 'trash', 'search']
    },

    writing: {
      title: 'Schreiben im Editor',
      summary:
        'Blöcke, Slash-Menü, Formatierung und Einfügen – alles, was du beim Schreiben brauchst.',
      keywords: [
        'slash',
        'block',
        'format',
        'fett',
        'kursiv',
        'liste',
        'überschrift',
        'textmarker',
        'einfügen',
        'paste',
        'anführungszeichen',
        'gedankenstrich',
        'typografie',
        'klammern',
        'url'
      ],
      blocks: [
        {
          kind: 'p',
          text: 'Jeder Absatz ist ein **Block**. Tippe `/` am Anfang einer Zeile, um einen Block zu wählen: Überschriften, Listen, Aufgaben, Zitate, Code, [Hinweisboxen](topic:callouts), Diagramme, [Formeln](topic:math), [Datenbanken](topic:tables) und deine [Vorlagen](topic:templates).'
        },
        {
          kind: 'p',
          text: 'Markdown-Kürzel funktionieren beim Tippen: `# ` wird zur Überschrift, `- ` zur Liste, `[] ` zur Aufgabe, `> ` zum Zitat und `` ``` `` zu Code.'
        },
        {
          kind: 'example',
          markdown:
            '## Probier es hier\n\nMarkiere ein Wort – die Formatierungsleiste erscheint. Oder tippe ==so== für einen Textmarker.\n\n1. Erster Schritt\n2. Zweiter Schritt\n\n> Ein Zitat bleibt ein Zitat.\n'
        },
        { kind: 'h', text: 'Formatieren' },
        {
          kind: 'keys',
          items: [
            { keys: 'CmdOrCtrl+B', label: 'Fett' },
            { keys: 'CmdOrCtrl+I', label: 'Kursiv' },
            { keys: 'CmdOrCtrl+Shift+S', label: 'Durchgestrichen' },
            { keys: 'CmdOrCtrl+E', label: 'Code im Text' },
            { keys: 'Control+CmdOrCtrl+H', label: 'Textmarker' },
            { keys: 'CmdOrCtrl+Alt+1', label: 'Überschrift 1 (bis 6)' },
            { keys: 'CmdOrCtrl+Shift+9', label: 'Aufgabe' },
            { keys: 'Tab', label: 'Einrücken' },
            { keys: 'Shift+Tab', label: 'Ausrücken' }
          ]
        },
        { kind: 'h', text: 'Blöcke bewegen' },
        {
          kind: 'p',
          text: 'Fahre mit der Maus links neben einen Block: Mit dem Griff **⋮⋮** ziehst du ihn an eine andere Stelle, ein Klick darauf öffnet das Blockmenü – zum Löschen oder um einen [Link auf den Block](topic:blockrefs) zu kopieren.'
        },
        { kind: 'h', text: 'Beim Tippen' },
        {
          kind: 'list',
          items: [
            '**Typografische Zeichen:** Aus `"Hallo"` wird „Hallo“, aus `geht\'s` wird geht’s, aus `Wort -- Wort` ein Gedankenstrich und aus `...` eine Ellipse. **⌫** direkt danach nimmt es zurück. In Code bleibt alles, wie du es tippst; abschalten kannst du es in den [Einstellungen](topic:settings).',
            '**Markierung umschließen:** Markiere Text und tippe `(`, `[`, `{` oder `"` – der Text wird eingeklammert statt ersetzt. Zweimal `[` macht aus der Markierung einen [Link](topic:links).',
            '**Link einfügen:** Kopiere eine Adresse, markiere Text und füge sie mit {{keys:CmdOrCtrl+V}} ein – der Text wird zum Link.'
          ]
        },
        {
          kind: 'example',
          markdown: 'Markiere ein Wort und tippe zweimal [ – oder tippe hier "Anführungszeichen".\n'
        },
        {
          kind: 'tip',
          text: 'Eingefügter Text aus dem Browser, aus Chats oder aus anderen Editoren kommt formatiert an – Markdown wird dabei immer erkannt.'
        },
        {
          kind: 'note',
          text: 'Farben, Unterstreichen und Textausrichtung gibt es bewusst nicht: Markdown kann sie nicht speichern, und Write soll deine Dateien sauber halten.'
        }
      ],
      related: ['markdown', 'callouts', 'code']
    },

    markdown: {
      title: 'Markdown-Modus',
      summary: 'Eine Seite als reines Markdown bearbeiten – allein oder mit Vorschau daneben.',
      keywords: ['quelltext', 'source', 'vorschau', 'preview', 'modus', 'raw'],
      blocks: [
        {
          kind: 'p',
          text: 'Write zeigt eine Seite auf drei Arten. Umschalten kannst du oben rechts in der Toolbar oder per Tastatur:'
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
            '**Formatiert** – der Blockeditor, wie gewohnt.',
            '**Markdown** – der Text genau so, wie er in der Datei steht, mit Syntaxfarben.',
            '**Markdown mit Vorschau** – links schreiben, rechts das Ergebnis. Die Vorschau scrollt mit.'
          ]
        },
        {
          kind: 'p',
          text: 'Auch im Markdown-Modus werden `[[Links]]` und `#Tags` beim Tippen vervollständigt.'
        },
        {
          kind: 'note',
          text: 'Was der Blockeditor nicht kennt – etwa HTML oder Referenz-Links – zeigt er als grauen „Markdown“-Block. Mit einem Doppelklick bearbeitest du ihn als Text.'
        },
        { kind: 'try', command: 'view.modeSplit', label: 'Markdown mit Vorschau zeigen' }
      ],
      related: ['writing', 'welcome']
    },

    links: {
      title: 'Links & Backlinks',
      summary: 'Seiten mit [[Wiki-Links]] verbinden und sehen, wer auf eine Seite verweist.',
      keywords: ['wikilink', 'verlinken', 'backlink', 'erwähnung', 'abschnitt', 'alias', 'verweis'],
      blocks: [
        {
          kind: 'steps',
          items: [
            'Tippe `[[` – eine Liste deiner Seiten erscheint.',
            'Wähle eine Seite oder tippe einen neuen Titel: Ein Klick auf einen Link zu einer Seite, die es noch nicht gibt, legt sie an.',
            'Ein Klick auf den Link öffnet die Seite, mit **⌘-Klick** öffnet sie sich [daneben](topic:split).',
            'Bleibst du kurz mit der Maus auf einem Link, zeigt eine **Vorschau** den Anfang der Seite – ohne sie zu öffnen.'
          ]
        },
        {
          kind: 'example',
          markdown:
            'Siehe [[Projekt Apollo]], besonders [[Projekt Apollo#Ziele]].\n\nMit eigenem Text: [[Projekt Apollo|unser großes Projekt]].\n\nFehlende Seiten erscheinen gestrichelt: [[Gibt es noch nicht]].\n'
        },
        {
          kind: 'list',
          items: [
            '`[[Seite]]` – auf eine Seite',
            '`[[Seite#Überschrift]]` – auf einen Abschnitt',
            '`[[Seite#^id]]` – auf einen einzelnen Block, siehe [Blockreferenzen](topic:blockrefs)',
            '`[[Seite|Text]]` – mit eigenem Linktext',
            '`[[Ordner/Seite]]` – eindeutig, wenn es mehrere Seiten gleichen Namens gibt'
          ]
        },
        { kind: 'h', text: 'Backlinks' },
        {
          kind: 'p',
          text: 'Unter jeder Seite steht **Verlinkt von** – alle Seiten, die hierher zeigen, mit dem Satz drumherum.'
        },
        { kind: 'h', text: 'Nicht verlinkte Erwähnungen' },
        {
          kind: 'p',
          text: 'Darunter findest du Seiten, die den Titel nur als Text erwähnen. Mit **Verlinken** wird daraus ein echter Link – rückgängig machen geht auch.'
        }
      ],
      related: ['blockrefs', 'embeds', 'graph']
    },

    blockrefs: {
      title: 'Blockreferenzen',
      summary:
        'Nicht nur auf Seiten verlinken, sondern auf einen einzelnen Absatz oder Listenpunkt.',
      keywords: ['block', 'absatz', '^', 'id', 'referenz', 'verweis', 'link kopieren'],
      blocks: [
        {
          kind: 'p',
          text: 'Ein Block bekommt eine Kennung, indem er mit ` ^id` endet. Ein Link `[[Seite#^id]]` springt dann genau dorthin, `![[Seite#^id]]` zeigt nur diesen Block an. Das Format ist dasselbe wie in Obsidian.'
        },
        {
          kind: 'steps',
          items: [
            'Fahre mit der Maus links neben den Block und klicke auf den Griff **⋮⋮**.',
            'Wähle **Link auf Block kopieren**. Write hängt eine Kennung an den Block, falls er noch keine hat.',
            'Füge den Link irgendwo ein – fertig.'
          ]
        },
        {
          kind: 'p',
          text: 'Alternativ: Cursor in den Block setzen und im Menü _Seite_ den Befehl **Link auf Block kopieren** wählen. Das klappt auch im [Markdown-Modus](topic:markdown).'
        },
        {
          kind: 'example',
          markdown:
            'Das Budget ist knapp, sagt [[Projekt Apollo#^budget]].\n\n![[Projekt Apollo#^budget]]\n\nDieser Satz hat selbst eine Kennung. ^mein-satz\n',
          caption: 'Die Kennung am Ende wird klein und grau angezeigt; in Exporten fehlt sie.'
        },
        {
          kind: 'tip',
          text: 'Listenpunkte nehmen ihre Unterpunkte mit. Code-Blöcke, Tabellen und Zitate bekommen die Kennung als eigene Zeile `^id` darunter.'
        }
      ],
      related: ['links', 'embeds']
    },

    embeds: {
      title: 'Einbettungen',
      summary: 'Andere Seiten, Abschnitte oder Bilder direkt in eine Seite holen.',
      keywords: ['embed', 'einbetten', 'transclusion', 'bild', 'image', '![['],
      blocks: [
        {
          kind: 'p',
          text: 'Ein Ausrufezeichen vor einem Link bettet ein, statt nur zu verlinken. Die eingebettete Seite bleibt eine Vorschau – bearbeitet wird sie an ihrem Ort, ein Klick auf den Titel öffnet sie.'
        },
        {
          kind: 'example',
          markdown: 'Die Ziele des Projekts:\n\n![[Projekt Apollo#Ziele]]\n'
        },
        {
          kind: 'list',
          items: [
            '`![[Seite]]` – die ganze Seite',
            '`![[Seite#Abschnitt]]` – nur ein Abschnitt',
            '`![[Seite#^id]]` – nur ein [Block](topic:blockrefs)',
            '`![[Bild.png]]` – ein Bild aus dem Vault; `![[Bild.png|300]]` mit 300 Pixeln Breite'
          ]
        },
        {
          kind: 'tip',
          text: 'Bilder ziehst du einfach in eine Seite. Write legt sie neben der Seite in einem Ordner `_assets` ab.'
        }
      ],
      related: ['links', 'blockrefs']
    },

    tags: {
      title: 'Tags',
      summary: 'Seiten mit #Tags quer zu Ordnern ordnen – auch verschachtelt.',
      keywords: ['tag', 'hashtag', 'schlagwort', 'verschachtelt', 'umbenennen'],
      blocks: [
        {
          kind: 'p',
          text: 'Schreibe `#tag` irgendwo in den Text oder füge Tags unter dem Titel hinzu. Mit `/` verschachtelst du: `#projekt/write` gehört zu `#projekt`, und eine Suche nach `#projekt` findet beide.'
        },
        {
          kind: 'example',
          markdown: 'Notizen zu #projekt/write und #idee – Tags werden beim Tippen erkannt.\n'
        },
        {
          kind: 'p',
          text: 'Die Tag-Übersicht ({{cmd:tags.show}}) zeigt alle Tags als Baum. Dort kannst du einen Tag für **alle Seiten auf einmal umbenennen**.'
        },
        { kind: 'try', command: 'tags.show', label: 'Tag-Übersicht öffnen' }
      ],
      related: ['search', 'properties', 'graph']
    },

    graph: {
      title: 'Graph',
      summary: 'Deine Seiten als Sonnensysteme in 3D – sehen, was zusammenhängt.',
      keywords: ['graph', 'netz', 'verbindungen', '3d', 'sonnensystem', 'karte'],
      blocks: [
        {
          kind: 'list',
          items: [
            'Der **globale Graph** ({{cmd:graph.show}}) zeigt jede Gruppe eng verknüpfter Seiten als eigenes Sonnensystem. Seiten ohne Links kreisen im Asteroidengürtel.',
            'Der **lokale Graph** einer Seite (Knopf oben rechts) zeigt sie als Sonne, ihre Links als Planeten und Monde.',
            'Tags erscheinen als goldene Himmelskörper.'
          ]
        },
        {
          kind: 'p',
          text: 'Ein Klick wählt aus, ein Doppelklick öffnet die Seite. Über das Suchfeld springst du zu einer Seite, **In die Mitte** macht sie zur Sonne.'
        },
        { kind: 'try', command: 'graph.show', label: 'Graph zeigen' }
      ],
      related: ['links', 'tags']
    },

    properties: {
      title: 'Eigenschaften',
      summary: 'Status, Fälligkeit, Kunde, Budget – strukturierte Angaben für jede Seite.',
      keywords: ['eigenschaft', 'property', 'frontmatter', 'yaml', 'metadaten', 'status', 'feld'],
      blocks: [
        {
          kind: 'steps',
          items: [
            'Klicke unter dem Titel auf **+ Eigenschaft**.',
            'Gib einen Namen ein – Namen von Nachbarseiten werden vorgeschlagen.',
            'Wähle den Typ und trage den Wert ein.'
          ]
        },
        {
          kind: 'list',
          items: [
            '**Text** und **Zahl**',
            '**Datum** – mit Kalender',
            '**Checkbox** – ja oder nein',
            '**Seitenlink** – zeigt auf eine andere Seite',
            '**Liste** – mehrere Werte, etwa Beteiligte'
          ]
        },
        {
          kind: 'p',
          text: 'Gespeichert wird alles im **Frontmatter** am Anfang der Datei, ganz normales YAML:'
        },
        {
          kind: 'example',
          markdown:
            '```yaml\n---\ntitle: Website-Relaunch\nstatus: In Arbeit\nfällig: 2026-11-15\nbudget: 12000\nkunde: "[[Projekt Apollo]]"\n---\n```\n',
          caption:
            'So steht es am Anfang der Datei; in Write siehst du dazu ein aufgeräumtes Formular.'
        },
        {
          kind: 'tip',
          text: 'Eigenschaften spielen ihre Stärke in [Tabellen](topic:tables) aus: sortieren, filtern, direkt bearbeiten.'
        }
      ],
      related: ['tables', 'tasks']
    },

    tables: {
      title: 'Tabellen & Datenbanken',
      summary:
        'Seiten eines Ordners als Tabelle sehen, filtern und bearbeiten – auch mitten in einer Seite.',
      keywords: [
        'tabelle',
        'datenbank',
        'database',
        'filter',
        'sortieren',
        'spalten',
        'write-table'
      ],
      blocks: [
        { kind: 'h', text: 'Ein Ordner als Tabelle' },
        {
          kind: 'p',
          text: 'Öffne einen Ordner und schalte oben rechts von **Karten** auf **Tabelle**. Jede Seite ist eine Zeile, jede [Eigenschaft](topic:properties) eine Spalte. Zellen bearbeitest du direkt, unten legst du neue Seiten an.'
        },
        {
          kind: 'list',
          items: [
            'Klick auf eine Spaltenüberschrift: sortieren, ausblenden.',
            '**+ Filter**: Bedingungen wie „ist“, „enthält“, „ist leer“, „vor“ und „nach“.',
            '**Spalten**: auswählen und anordnen, was du sehen willst.'
          ]
        },
        { kind: 'h', text: 'Eine Datenbank in einer Seite' },
        {
          kind: 'p',
          text: 'Tippe `/Datenbank` – mitten in der Seite erscheint eine Tabelle, zunächst mit den Unterseiten dieser Seite. Über `</>` stellst du ein, welcher Ordner gezeigt wird. Dahinter steht ein kleiner YAML-Block:'
        },
        {
          kind: 'example',
          markdown:
            '```yaml\nfrom: Projekte\ncolumns: [status, fällig]\nsort: [{ key: fällig, dir: asc }]\nfilter: [{ key: status, op: isNot, value: Erledigt }]\n```\n',
          caption:
            'Die Einstellungen einer eingebetteten Tabelle, wie sie im Code-Block `write-table` stehen.'
        },
        {
          kind: 'tip',
          text: 'Datumsfilter verstehen `heute`, `morgen`, `gestern` und Abstände wie `heute+7` – so zeigt eine Tabelle immer, was diese Woche fällig ist.'
        }
      ],
      related: ['properties', 'tasks']
    },

    tasks: {
      title: 'Aufgaben & Fälligkeiten',
      summary: 'To-dos in jeder Seite – und eine Liste aller offenen Aufgaben im ganzen Vault.',
      keywords: ['aufgabe', 'todo', 'to-do', 'checkbox', 'fällig', 'due', 'erledigt'],
      blocks: [
        {
          kind: 'p',
          text: 'Eine Aufgabe ist ein Listenpunkt mit Kästchen: `- [ ]` oder {{keys:CmdOrCtrl+Shift+9}}. Ein Fälligkeitsdatum schreibst du als `📅 2026-10-20` dahinter, wie in Obsidian.'
        },
        {
          kind: 'example',
          markdown:
            '- [ ] Angebot schicken 📅 2026-10-20\n- [ ] Präsentation vorbereiten\n- [x] Termin vereinbaren\n'
        },
        { kind: 'h', text: 'Alle Aufgaben auf einen Blick' },
        {
          kind: 'p',
          text: 'Tippe `/Aufgaben` – eine Tabelle sammelt alle offenen To-dos aus deinen Notizen, sortiert nach Fälligkeit. Überfälliges steht in Rot. **Abhaken in der Tabelle hakt in der Notiz ab.**'
        }
      ],
      related: ['tables', 'journal']
    },

    journal: {
      title: 'Journal & Kalender',
      summary:
        'Eine Seite pro Tag – für Notizen, Gedanken und alles, was nirgends sonst hingehört.',
      keywords: ['journal', 'tagebuch', 'daily', 'heute', 'kalender', 'datum'],
      blocks: [
        {
          kind: 'p',
          text: 'Mit {{cmd:journal.today}} oder **Heute** in der Seitenleiste öffnest du die Seite des Tages. Sie liegt als `Journal/2026-10-09.md` im Vault.'
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
          text: 'Über jeder Journalseite steht der Tag in Worten, Pfeile zum vorherigen und nächsten Eintrag und ein **Kalender**, der Tage mit Einträgen markiert.'
        },
        {
          kind: 'tip',
          text: 'Mit [Quick Capture](topic:capture) landet ein Gedanke aus jeder App im heutigen Journal – ohne Write zu öffnen.'
        },
        { kind: 'try', command: 'journal.today', label: 'Journal von heute öffnen' }
      ],
      related: ['capture', 'templates']
    },

    templates: {
      title: 'Vorlagen',
      summary: 'Wiederkehrende Seiten wie Besprechungen oder Projekte mit einem Griff anlegen.',
      keywords: ['vorlage', 'template', 'platzhalter', 'besprechung'],
      blocks: [
        {
          kind: 'p',
          text: 'Vorlagen sind normale Markdown-Dateien im Ordner `.docuapp/templates` deines Vaults. Write legt zum Start „Besprechung“ und „Projekt“ an – ändere sie oder lege eigene dazu.'
        },
        {
          kind: 'list',
          items: [
            '`{{title}}` – Titel der Seite',
            '`{{date}}` und `{{time}}` – Datum und Uhrzeit',
            '`{{weekday}}` – der Wochentag'
          ]
        },
        {
          kind: 'p',
          text: 'Einfügen: {{cmd:template.insert}}, oder tippe `/` und den Namen der Vorlage. In der Befehlspalette gibt es außerdem **Neue Seite aus Vorlage**.'
        },
        {
          kind: 'example',
          markdown:
            '# {{title}}\n\n**Datum:** {{date}} · {{time}}\n\n## Themen\n\n1. \n\n## Aufgaben\n\n- [ ] \n',
          caption: 'Ein Ausschnitt der mitgelieferten Vorlage „Besprechung“.'
        }
      ],
      related: ['journal', 'pages']
    },

    callouts: {
      title: 'Callouts',
      summary: 'Hinweise, Tipps und Warnungen, die aus dem Text herausstechen.',
      keywords: ['callout', 'hinweis', 'warnung', 'tipp', 'box', 'admonition'],
      blocks: [
        {
          kind: 'p',
          text: 'Tippe `/Hinweisbox` (oder `/Callout`) oder schreibe `> [!note]` am Anfang einer Zeile. Die Art wählst du über das Symbol links, der Titel ist optional.'
        },
        {
          kind: 'example',
          markdown:
            '> [!tip] Gut zu wissen\n> Callouts sind ganz normale Zitate mit einer Markierung.\n\n> [!warning]\n> Vorsicht, das hier ist wichtig.\n'
        },
        {
          kind: 'p',
          text: 'Arten: `note`, `info`, `tip`, `success`, `question`, `warning`, `danger`, `important`, `caution`, `todo`, `example` und `quote` – kompatibel mit Obsidian und GitHub.'
        }
      ],
      related: ['writing', 'code']
    },

    code: {
      title: 'Code & Diagramme',
      summary: 'Code mit Syntaxfarben und Mermaid-Diagramme, die beim Tippen entstehen.',
      keywords: ['code', 'programm', 'syntax', 'mermaid', 'diagramm', 'flowchart', 'einrückung'],
      blocks: [
        {
          kind: 'p',
          text: 'Drei Backticks `` ``` `` oder `/Code` beginnen einen Code-Block. Die Sprache wählst du oben im Block. **Tab** und **⇧Tab** rücken markierte Zeilen ein und aus, Enter behält die Einrückung.'
        },
        {
          kind: 'example',
          markdown: '```ts\nfunction gruss(name: string) {\n  return `Hallo ${name}`\n}\n```\n'
        },
        { kind: 'h', text: 'Mermaid-Diagramme' },
        {
          kind: 'p',
          text: 'Mit `/Mermaid` erscheint ein Diagramm. Über `</>` oder einen Doppelklick klappt daneben der Code auf; das Diagramm aktualisiert sich beim Tippen, **Escape** klappt ihn wieder zu.'
        },
        {
          kind: 'example',
          markdown: '```mermaid\ngraph LR\n  Idee --> Entwurf --> Fertig\n```\n'
        }
      ],
      related: ['math', 'writing']
    },

    math: {
      title: 'Formeln',
      summary: 'Mathematik im Text und als eigener Block, gesetzt mit LaTeX.',
      keywords: ['formel', 'mathe', 'latex', 'katex', 'gleichung'],
      blocks: [
        {
          kind: 'list',
          items: [
            '`$E = mc^2$` – eine Formel mitten im Satz.',
            '`$$ … $$` – eine Formel als eigener Block.',
            'Im Slash-Menü: **Formel** und **Formel im Text**.'
          ]
        },
        {
          kind: 'example',
          markdown: 'Einstein schrieb $E = mc^2$.\n\n$$\n\\int_0^1 x^2 \\, dx = \\frac{1}{3}\n$$\n',
          caption: 'Klicke auf eine Formel, um ihren LaTeX-Code zu bearbeiten.'
        }
      ],
      related: ['code', 'footnotes']
    },

    footnotes: {
      title: 'Fußnoten',
      summary: 'Anmerkungen, die den Lesefluss nicht unterbrechen.',
      keywords: ['fußnote', 'fussnote', 'anmerkung', 'quelle', 'footnote'],
      blocks: [
        {
          kind: 'p',
          text: 'Tippe `/Fußnote`: Write setzt eine hochgestellte Nummer und legt die Notiz am Ende der Seite an. Ein Klick auf die Nummer springt zur Notiz.'
        },
        {
          kind: 'example',
          markdown:
            'Write speichert alles als Markdown.[^1]\n\n[^1]: Genauer: als CommonMark mit ein paar verbreiteten Erweiterungen.\n'
        }
      ],
      related: ['math', 'writing']
    },

    split: {
      title: 'Geteilte Ansicht',
      summary: 'Zwei Seiten nebeneinander – recherchieren links, schreiben rechts.',
      keywords: ['split', 'nebeneinander', 'zwei seiten', 'daneben', 'teilen', 'spalte'],
      blocks: [
        {
          kind: 'steps',
          items: [
            'Öffne die geteilte Ansicht mit {{cmd:view.splitPane}} oder dem Knopf mit den zwei Rechtecken oben rechts. Rechts erscheint die zuletzt geöffnete andere Seite.',
            'Oder öffne gezielt eine Seite daneben: **⌘-Klick** auf einen Link, einen Backlink oder einen Favoriten – oder **Daneben öffnen** im Kontextmenü des Seitenbaums.',
            'Ziehe den Trenner, um die Breite zu ändern. Ein Doppelklick teilt wieder halb und halb.'
          ]
        },
        {
          kind: 'p',
          text: 'Die Hälfte, in die du zuletzt geklickt hast, ist **aktiv**: Dorthin öffnen Seitenbaum und Befehlspalette Seiten, und dort wirken Befehle wie Umbenennen oder Suchen. Der Titel der anderen Hälfte wird blasser.'
        },
        {
          kind: 'list',
          items: [
            'Toolbar, Gliederung und Seiteninfo gehören zur linken Seite.',
            'Der Pfeil in der rechten Kopfzeile holt die Seite nach links, das ✕ schließt die rechte Seite.',
            'Ist dieselbe Seite links und rechts offen, erscheint jede Änderung sofort auf beiden Seiten.'
          ]
        },
        { kind: 'try', command: 'view.splitPane', label: 'Geteilte Ansicht öffnen' }
      ],
      related: ['links', 'focus']
    },

    search: {
      title: 'Suche & Befehlspalette',
      summary: 'Seiten, Text und Befehle finden, ohne die Hände von der Tastatur zu nehmen.',
      keywords: ['suche', 'finden', 'volltext', 'palette', 'befehl', 'ersetzen', 'quick open'],
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
            '**Befehlspalette** – Seiten öffnen, neue anlegen, jeden Befehl ausführen. Ganz unten: Volltextsuche nach dem Eingegebenen.',
            '**Volltextsuche** – durchsucht alle Seiten, auch nach Tags. Ein Treffer öffnet die Seite mit markierten Stellen.',
            '**Suchen und Ersetzen** – in der offenen Seite, auf Wunsch mit Groß-/Kleinschreibung.'
          ]
        },
        { kind: 'try', command: 'palette.open', label: 'Befehlspalette öffnen' }
      ],
      related: ['tags', 'pages']
    },

    focus: {
      title: 'Fokusmodus & Gliederung',
      summary: 'Alles ausblenden außer dem Text – oder den Überblick über lange Seiten behalten.',
      keywords: ['fokus', 'ablenkung', 'gliederung', 'outline', 'inhaltsverzeichnis', 'wörter'],
      blocks: [
        {
          kind: 'p',
          text: '**Fokusmodus** ({{cmd:view.focus}}) blendet Seitenleiste und Toolbar aus und dimmt alle Absätze außer dem, in dem du gerade schreibst. Die Zeile, in der du tippst, bleibt dabei in der Mitte des Fensters, wie bei einer Schreibmaschine.'
        },
        {
          kind: 'p',
          text: 'Die **Gliederung** ({{cmd:page.outline}}) zeigt rechts alle Überschriften der Seite. Ein Klick springt hin, der Abschnitt, den du gerade liest, ist hervorgehoben.'
        },
        {
          kind: 'p',
          text: 'Wie viele Wörter eine Seite hat, steht oben in der Toolbar; mehr Details zeigt die Seiteninfo ({{cmd:page.info}}).'
        },
        { kind: 'try', command: 'view.focus', label: 'Fokusmodus einschalten' }
      ],
      related: ['split', 'settings']
    },

    capture: {
      title: 'Quick Capture',
      summary: 'Einen Gedanken aus jeder App festhalten – mit einem Tastendruck.',
      keywords: ['capture', 'schnell', 'notiz', 'erfassen', 'global', 'kurzbefehl'],
      blocks: [
        {
          kind: 'steps',
          items: [
            'Drücke {{keys:Control+Alt+Space}} – egal, in welcher App du gerade bist.',
            'Schreib deinen Gedanken in das kleine Fenster.',
            '**Enter** sichert ihn ins heutige [Journal](topic:journal), **⇧Enter** macht eine neue Zeile, **Escape** schließt.'
          ]
        },
        {
          kind: 'tip',
          text: 'Den Kurzbefehl änderst du in den Einstellungen unter **Quick Capture**.'
        },
        { kind: 'try', command: 'capture.open', label: 'Quick Capture öffnen' }
      ],
      related: ['journal', 'settings']
    },

    share: {
      title: 'Teilen & Export',
      summary: 'Eine Seite oder einen Ausschnitt als Markdown, PDF oder HTML weitergeben.',
      keywords: ['teilen', 'export', 'pdf', 'html', 'drucken', 'airdrop', 'mail', 'kopieren'],
      blocks: [
        {
          kind: 'p',
          text: 'Der **Teilen**-Knopf oben rechts gibt die Seite über Mail, Nachrichten, AirDrop und Co. weiter – als Markdown, PDF oder HTML. Ist Text markiert, wird nur der Ausschnitt geteilt.'
        },
        {
          kind: 'list',
          items: [
            '**Als Markdown kopieren** – für Chats, Tickets oder andere Editoren.',
            'Im Menü _Seite_: **Als PDF exportieren**, **Als HTML exportieren** und **Drucken** ({{cmd:page.print}}).'
          ]
        },
        {
          kind: 'note',
          text: 'Exporte sind immer hell gesetzt, auch im Dunkelmodus – damit sie gedruckt und anderswo gut aussehen.'
        }
      ],
      related: ['markdown', 'history']
    },

    history: {
      title: 'Versionsgeschichte',
      summary: 'Jede Seite hat ihre Geschichte – ältere Stände ansehen, vergleichen, zurückholen.',
      keywords: [
        'version',
        'historie',
        'verlauf',
        'snapshot',
        'wiederherstellen',
        'rückgängig',
        'backup'
      ],
      blocks: [
        {
          kind: 'p',
          text: 'Nach einer kurzen Schreibpause (standardmäßig 4 Sekunden) hält Write automatisch eine Version fest. Du musst nie speichern.'
        },
        {
          kind: 'steps',
          items: [
            'Öffne die Versionsgeschichte mit {{cmd:page.history}} oder der Uhr oben rechts.',
            'Wähle links einen Stand – rechts siehst du die Unterschiede zur aktuellen Version.',
            '**Diese Version wiederherstellen** holt ihn zurück. Auch das ist wieder eine Version, also nichts geht verloren.'
          ]
        },
        {
          kind: 'p',
          text: 'Die Geschichte liegt außerhalb des Vaults (in einem lokalen Git-Archiv) und wird nicht mitsynchronisiert. Wie lange sie aufgehoben wird, stellst du in den [Einstellungen](topic:settings) ein.'
        }
      ],
      related: ['trash', 'conflicts']
    },

    conflicts: {
      title: 'Sync-Konflikte',
      summary: 'Wenn zwei Geräte dieselbe Seite gleichzeitig ändern, entscheidest du, was gilt.',
      keywords: ['konflikt', 'sync', 'icloud', 'dropbox', 'nextcloud', 'konfliktkopie', 'extern'],
      blocks: [
        { kind: 'h', text: 'Änderung von außen' },
        {
          kind: 'p',
          text: 'Ändert sich eine Seite auf der Festplatte, während du sie bearbeitest, erscheint oben ein Hinweis. **Vergleichen** zeigt beide Fassungen nebeneinander, danach wählst du **Externe Version laden** oder **Meine Version speichern** – das lässt sich auch widerrufen.'
        },
        { kind: 'h', text: 'Konfliktkopien' },
        {
          kind: 'p',
          text: 'Manche Sync-Dienste legen bei gleichzeitigen Änderungen eine Kopie an, etwa „Seite (conflicted copy …).md“. Write erkennt sie und zeigt sie unter **Konflikte** ({{cmd:conflicts.show}}): **Meine behalten**, **Konfliktkopie übernehmen** oder **Beide behalten**.'
        },
        {
          kind: 'tip',
          text: 'Im Zweifel ist nichts verloren: Jede Fassung, die Write gespeichert hat, steht auch in der [Versionsgeschichte](topic:history).'
        }
      ],
      related: ['history', 'welcome']
    },

    trash: {
      title: 'Papierkorb',
      summary: 'Gelöschte Seiten landen erst einmal im Papierkorb – und kommen von dort zurück.',
      keywords: ['papierkorb', 'löschen', 'wiederherstellen', 'trash', 'gelöscht'],
      blocks: [
        {
          kind: 'list',
          items: [
            'Löschen mit {{cmd:page.trash}} oder über das Kontextmenü. Direkt danach bietet ein Hinweis **Rückgängig** an.',
            'Der **Papierkorb** in der Seitenleiste zeigt alles Gelöschte – **Wiederherstellen** legt es an den alten Platz zurück.',
            'Nach 30 Tagen wird endgültig geleert. Die Frist änderst du in den [Einstellungen](topic:settings), auch auf „Nie“.'
          ]
        },
        {
          kind: 'p',
          text: 'Der Papierkorb ist ein Ordner `.trash` im Vault und wird deshalb mitsynchronisiert.'
        },
        { kind: 'try', command: 'trash.show', label: 'Papierkorb öffnen' }
      ],
      related: ['history', 'pages']
    },

    ai: {
      title: 'KI-Assistenten',
      summary:
        'Claude, OpenCode und andere können deinen Vault durchsuchen, lesen und – wenn du willst – bearbeiten.',
      keywords: ['ki', 'ai', 'claude', 'mcp', 'assistent', 'opencode', 'chatgpt', 'llm'],
      blocks: [
        {
          kind: 'p',
          text: 'Write spricht das **Model Context Protocol (MCP)**. Damit kann ein KI-Assistent auf deine Notizen zugreifen – suchen, lesen, Eigenschaften filtern, offene Aufgaben auflisten und, wenn du es erlaubst, Seiten anlegen und ändern.'
        },
        {
          kind: 'steps',
          items: [
            'Öffne die [Einstellungen](topic:settings) ({{cmd:settings.open}}) und gehe zu **KI-Assistenten**.',
            'Wähle **Nur lesen** oder **Lesen und schreiben**.',
            'Kopiere die angezeigte Konfiguration in deinen Assistenten – für Claude Desktop, Claude Code im Terminal oder OpenCode steht jeweils dabei, wohin.'
          ]
        },
        {
          kind: 'note',
          text: 'Was der Assistent liest, geht an seinen Anbieter. Jede Änderung, die er macht, landet in der [Versionsgeschichte](topic:history) und lässt sich dort zurückholen.'
        },
        { kind: 'try', command: 'settings.open', label: 'Einstellungen öffnen' }
      ],
      related: ['settings', 'history']
    },

    shortcuts: {
      title: 'Tastenkürzel',
      summary: 'Die wichtigsten Kurzbefehle – und wo du alle findest.',
      keywords: ['tastatur', 'kurzbefehl', 'shortcut', 'taste', 'hotkey'],
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
          text: 'Alle Kurzbefehle – auch die des Editors – zeigt die Übersicht {{cmd:shortcuts.show}}, mit Suchfeld.'
        },
        { kind: 'try', command: 'shortcuts.show', label: 'Alle Tastenkürzel zeigen' }
      ],
      related: ['search', 'writing']
    },

    settings: {
      title: 'Einstellungen',
      summary: 'Schrift, Zeilenbreite, Erscheinungsbild, Vaults und was Write im Hintergrund tut.',
      keywords: [
        'einstellungen',
        'schrift',
        'dunkel',
        'hell',
        'theme',
        'breite',
        'sprache',
        'updates'
      ],
      blocks: [
        {
          kind: 'list',
          items: [
            '**Darstellung** – Schrift (System, Serif, Monospace), Schriftgröße, Zeilenbreite, typografische Zeichen und Hell/Dunkel. Die Akzentfarbe folgt macOS.',
            '**Sprache** – Deutsch oder Englisch, oder wie das System.',
            '**Vaults** – geöffnete Vaults, im Finder zeigen, aus der Liste entfernen.',
            '**Quick Capture** – der Kurzbefehl, der aus jeder App eine Notiz aufnimmt.',
            '**Daten** – wann der Papierkorb geleert wird, wann Versionen entstehen und wie lange sie bleiben; Suchindex neu aufbauen.',
            '**KI-Assistenten** – siehe [KI-Assistenten](topic:ai).',
            '**Über Write** – Version, Lizenz, Datenschutz und Updates.'
          ]
        },
        {
          kind: 'p',
          text: 'Hell und Dunkel schaltest du auch schnell über _Darstellung → Hell/Dunkel umschalten_ um.'
        },
        { kind: 'try', command: 'settings.open', label: 'Einstellungen öffnen' }
      ],
      related: ['ai', 'focus']
    }
  }
}
