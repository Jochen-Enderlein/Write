# Neuerungen in Write

Jede Version bekommt hier einen Abschnitt `## x.y.z – Datum`, neueste oben. `npm run release`
veröffentlicht nur, wenn der Abschnitt zur Version in `package.json` existiert. Der Text wird
zum GitHub-Release und erscheint nach dem Update einmal in der App. Geschrieben für Menschen,
die Write benutzen – nicht für Entwickler.

## 0.4.0 – 2026-10-08

### Neu

- **Eigenschaften:** Unter dem Titel stehen jetzt alle Eigenschaften einer Seite – Status, Fälligkeit, Kunde, Budget … – und lassen sich direkt bearbeiten: als Text, Zahl, Datum, Checkbox, Link auf eine Seite oder Liste. Über _+ Eigenschaft_ kommen neue dazu, Namen von Nachbarseiten werden vorgeschlagen. Gespeichert wird alles ganz normal im Frontmatter der Datei.
- **Tabellen:** Ein Ordner zeigt seine Seiten auf Wunsch als Tabelle (Umschalter _Karten | Tabelle_ oben rechts). Zellen bearbeiten, nach Spalten sortieren, filtern, Spalten ein- und ausblenden und neue Seiten direkt in der Tabelle anlegen.
- **Datenbank in einer Seite:** Mit _/Datenbank_ erscheint eine solche Tabelle mitten in einer Seite – zum Beispiel die Unterseiten von „Projekte“ auf der Seite „Projekte“ selbst. Über `</>` lässt sich einstellen, welcher Ordner gezeigt wird.
- **Filter relativ zu heute:** Datumsfilter verstehen `heute`, `morgen`, `gestern` und Abstände wie `heute+7` – so zeigt eine Tabelle immer, was überfällig oder diese Woche fällig ist.
- **KI-Assistenten** können Eigenschaften lesen, Seiten danach filtern und Eigenschaften ändern.

## 0.3.0 – 2026-10-07

### Neu

- **KI-Assistenten:** Claude, OpenCode und andere können deinen Vault durchsuchen, lesen und – wenn du es erlaubst – Seiten anlegen und ändern. Einschalten und einrichten unter _Einstellungen → KI-Assistenten_. Jede Änderung landet in der Versionsgeschichte und lässt sich dort rückgängig machen.
- **Teilen:** Über den Teilen-Knopf oben rechts eine Seite – oder nur den markierten Teil – als Markdown, PDF oder HTML per Mail, Nachrichten, AirDrop & Co. weitergeben oder als Markdown kopieren.
- **Formeln:** `$E = mc^2$` im Text und `$$ … $$` als eigener Block werden schön gesetzt. Im Slash-Menü unter _Formel_.
- **Fußnoten:** `[^1]` erscheint als kleiner Verweis, ein Klick springt zur Notiz. Im Slash-Menü unter _Fußnote_.
- **Verschachtelte Tags:** `#projekt/write` ordnet sich unter `#projekt` ein; die Tag-Übersicht zeigt einen Baum, und Tags lassen sich für alle Seiten umbenennen.

### Verbessert

- Im Markdown-Modus werden `[[Links]]` und `#Tags` beim Tippen vervollständigt.

### Behoben

- Der PDF-Export erzeugt wieder vollständige Seiten statt einer leeren.

## 0.2.1 – 2026-10-07

### Verbessert

- Neues, ruhigeres App-Symbol: nur noch das W.

## 0.2.0 – 2026-10-07

### Neu

- **Graph:** Deine Seiten als Sonnensystem in 3D. Die globale Ansicht (Seitenleiste → _Graph_ oder ⌃⌘G) zeigt jede Gruppe eng verknüpfter Seiten als eigenes Sonnensystem, Seiten ohne Verknüpfung kreisen im Asteroidengürtel. Über den Knopf oben rechts auf einer Seite siehst du ihren lokalen Graphen: die Seite als Sonne, ihre Links als Planeten und Monde. Tags erscheinen als goldene Himmelskörper. Klick wählt aus, Doppelklick öffnet.
- **Markdown-Modus:** Seiten lassen sich jetzt auch als reines Markdown bearbeiten – oder geteilt, mit Markdown links und Vorschau rechts. Umschalten über die drei Knöpfe in der Toolbar oder ⌃⌘1, ⌃⌘2 und ⌃⌘3.

## 0.1.2 – 2026-10-07

### Neu

- **Mermaid-Diagramme:** Auf der Seite steht nur noch das Diagramm. Über `</>` (oder einen Doppelklick) klappt daneben der Code auf; das Diagramm aktualisiert sich beim Tippen, Escape klappt den Code wieder zu.

### Verbessert

- Code-Blöcke behalten beim Zeilenumbruch die Einrückung, nach `{`, `(`, `[` und `:` eine Ebene mehr. Tab und ⇧Tab rücken markierte Zeilen ein und aus.

### Behoben

- Eingefügtes Markdown und formatierter Text, etwa aus einem Chat oder dem Browser, kommen formatiert an – auch mit Code-Blöcken, bei denen bisher gar nichts eingefügt wurde.
- In Mermaid-Diagrammen verrutscht beim Tippen nicht mehr die Einrückung.
- Write blockiert das Herunterfahren und Abmelden des Macs nicht mehr; offene Änderungen werden vorher gespeichert.
- Nach dem Start bleibt Write die aktive App: mit Punkt im Dock und eigener Menüleiste.

## 0.1.1 – 2026-10-06

### Behoben

- Write lässt sich wieder zuverlässig beenden und für ein Update neu starten, auch wenn im Hintergrund gerade die Versionsgeschichte geschrieben oder aufgeräumt wird. Deine Notizen sind dabei immer schon gespeichert.

## 0.1.0 – 2026-10-06

### Neu

- **Textmarker:** Text mit ⌃⌘H, über die Formatierungsleiste oder durch Tippen von `==Text==` markieren. Gespeichert wird er wie in Obsidian als `==markiert==`.
- **Erscheinungsbild:** In den Einstellungen zwischen System, Hell und Dunkel wählen – oder über _Darstellung → Hell/Dunkel umschalten_.
- **Ordner-Übersicht:** Ein Klick auf einen Ordner im Seitenbaum zeigt seine Seiten und Unterordner mit Vorschau und letzter Änderung.
- **Updates in der App:** Ein bereitliegendes Update erscheint unten in der Seitenleiste und lässt sich mit einem Klick installieren. _Write → Nach Updates suchen …_ prüft sofort. Automatisch sucht Write nur, wenn du es erlaubst – gefragt wird einmal beim zweiten Start.
- **Über Write:** In den Einstellungen stehen Version, Lizenz, Quellcode, Impressum, Datenschutzerklärung und was Write ins Internet sendet (nur die Update-Prüfung bei GitHub).

### Verbessert

- Beim Wechsel zwischen Seiten blitzt keine leere Seite mehr auf.
- Einstellungen neu geordnet, mit Vorschau für Schrift und Größe.
- Sync-Konflikte: „Vergleichen“ steht im Vordergrund, „Meine Version speichern“ lässt sich widerrufen.
- Write wird beim Start zuverlässig zur aktiven App, die Menüleiste stimmt sofort.
