# Neuerungen in Write

Jede Version bekommt hier einen Abschnitt `## x.y.z – Datum`, neueste oben. `npm run release`
veröffentlicht nur, wenn der Abschnitt zur Version in `package.json` existiert. Der Text wird
zum GitHub-Release und erscheint nach dem Update einmal in der App. Geschrieben für Menschen,
die Write benutzen – nicht für Entwickler.

## Unveröffentlicht

### Neu

- **UML-Klassendiagramme per Drag-and-drop:** Mit `/UML` legst du ein Klassendiagramm an. Klassen, Interfaces, abstrakte Klassen und Enums ziehst du aus einer Leiste ins Diagramm, Attribute und Methoden auf eine Klasse; Beziehungen wie Vererbung, Assoziation oder Komposition ziehst du einfach von einer Klasse zur anderen. Der Mermaid-Code daneben schreibt sich dabei mit – Namen und Typen passt du direkt dort an.

## 0.6.3 – 2026-11-04

### Neu

- **Diagramme groß anzeigen:** Flussdiagramme und andere Mermaid-Diagramme lassen sich über den Knopf mit den zwei Pfeilen über das ganze Fenster zeigen – und mit **F** im Vollbild. Dort zoomst du mit zwei Fingern, ⌘ und Scrollen oder **+** und **−**, verschiebst das Diagramm durch Ziehen, **0** zeigt wieder alles, **Escape** schließt.

## 0.6.2 – 2026-11-03

### Neu

- **Als Datei speichern:** Im Teilen-Menü kannst du die Seite – oder nur den markierten Ausschnitt – jetzt auch direkt als Markdown-, PDF- oder HTML-Datei speichern, statt sie nur weiterzugeben. Vorgeschlagen wird dein Ordner _Downloads_, danach zeigt der Finder die Datei.

### Behoben

- **Seitenbaum:** Ein Klick auf eine Seite öffnet sie jetzt auch dann, wenn sich der Baum genau in diesem Moment ändert – etwa weil eine Synchronisierung eine neue Seite darüber einfügt. Vorher wurde die Zeile nur markiert, die Seite blieb aber zu.
- **Seiten nebeneinander:** Ist dieselbe Seite links und rechts offen, bleibt der Cursor beim Schreiben jetzt in der Seite, in der du tippst. Vorher konnte er nach dem Speichern auf die andere Seite springen.

## 0.6.1 – 2026-11-02

### Behoben

- **Ansicht wechseln:** Schaltest du schnell zwischen _Formatiert_, _Markdown_ und _Markdown mit Vorschau_ hin und her, zeigt Write jetzt immer die Ansicht, die du zuletzt gewählt hast. Vorher konnte die Seite in einer anderen Ansicht hängen bleiben und ließ sich erst nach einem weiteren Wechsel wieder richtig anzeigen.

## 0.6.0 – 2026-10-10

### Neu

- **Link-Vorschau:** Bleibst du kurz mit der Maus auf einem `[[Link]]`, zeigt eine kleine Vorschau den Anfang der Seite – oder den Abschnitt bzw. Block, auf den er zeigt. Öffnen musst du sie dafür nicht.
- **Typografische Zeichen:** Beim Tippen wird aus `"Hallo"` „Hallo“, aus `geht's` geht’s, aus `Wort -- Wort` ein Gedankenstrich und aus `...` eine Ellipse. ⌫ direkt danach nimmt die Ersetzung zurück. In Code bleibt alles, wie du es tippst. Abschalten lässt es sich unter _Einstellungen → Darstellung_.
- **Markierung umschließen:** Markierten Text und dann `(`, `[`, `{` oder `"` tippen setzt die Zeichen um den Text, statt ihn zu ersetzen. Zweimal `[` macht aus der Markierung einen Link auf die gleichnamige Seite.
- **Schreibmaschinen-Scrollen:** Im Fokusmodus bleibt die Zeile, in der du schreibst, in der Mitte des Fensters.

### Verbessert

- **Write merkt sich, wo du warst:** Kehrst du auf eine Seite zurück – mit ⌘[, über einen Link oder die Seitenleiste –, steht sie an derselben Stelle wie vorher. Warst du gerade am Schreiben, wartet der Cursor dort, wo du aufgehört hast.
- **Link einfügen:** Eine kopierte Adresse über markierten Text eingefügt macht den Text zum Link, statt ihn zu ersetzen.

## 0.5.0 – 2026-10-09

### Neu

- **Seiten nebeneinander:** Zwei Seiten gleichzeitig offen – links recherchieren, rechts schreiben. Mit ⌘\ oder dem Knopf mit den zwei Rechtecken oben rechts, mit ⌘-Klick auf einen Link oder über _Daneben öffnen_ im Seitenbaum. Den Trenner kannst du ziehen; ist dieselbe Seite auf beiden Seiten offen, erscheint jede Änderung sofort auf beiden.
- **Blockreferenzen:** Verlinke nicht nur Seiten, sondern einzelne Absätze oder Listenpunkte – mit `[[Seite#^id]]`, oder bette sie mit `![[Seite#^id]]` ein. Über den Griff ⋮⋮ eines Blocks wählst du _Link auf Block kopieren_; die Kennung am Ende des Blocks wird klein und grau angezeigt. Das Format ist dasselbe wie in Obsidian.
- **Hilfe:** Ein eigenes Hilfe-Fenster erklärt alles, was Write kann – mit Suche, Beispielen zum Ausprobieren direkt im Editor und Knöpfen, die den Befehl gleich ausführen. Öffnen mit ⌘? oder unten in der Seitenleiste.

### Verbessert

- Scrollleisten sehen auch bei _Rollbalken immer anzeigen_ aus wie in anderen Mac-Apps: schmal und ohne graue Spur.

### Behoben

- Die Seitenleiste zittert in kleinen Fenstern nicht mehr, wenn man ganz nach unten scrollt; lange Seitennamen werden mit „…“ gekürzt.
- Die Formatierungsleiste zeigt keine Scrollleiste mehr, ihre Tooltips sind wieder vollständig zu sehen.

## 0.4.0 – 2026-10-08

### Neu

- **Eigenschaften:** Unter dem Titel stehen jetzt alle Eigenschaften einer Seite – Status, Fälligkeit, Kunde, Budget … – und lassen sich direkt bearbeiten: als Text, Zahl, Datum, Checkbox, Link auf eine Seite oder Liste. Über _+ Eigenschaft_ kommen neue dazu, Namen von Nachbarseiten werden vorgeschlagen. Gespeichert wird alles ganz normal im Frontmatter der Datei.
- **Tabellen:** Ein Ordner zeigt seine Seiten auf Wunsch als Tabelle (Umschalter _Karten | Tabelle_ oben rechts). Zellen bearbeiten, nach Spalten sortieren, filtern, Spalten ein- und ausblenden und neue Seiten direkt in der Tabelle anlegen.
- **Datenbank in einer Seite:** Mit _/Datenbank_ erscheint eine solche Tabelle mitten in einer Seite – zum Beispiel die Unterseiten von „Projekte“ auf der Seite „Projekte“ selbst. Über `</>` lässt sich einstellen, welcher Ordner gezeigt wird.
- **Filter relativ zu heute:** Datumsfilter verstehen `heute`, `morgen`, `gestern` und Abstände wie `heute+7` – so zeigt eine Tabelle immer, was überfällig oder diese Woche fällig ist.
- **Aufgaben aus allen Seiten:** Mit _/Aufgaben_ erscheint eine Tabelle aller offenen To-dos aus deinen Notizen – sortiert nach Fälligkeit, Überfälliges in Rot. Abhaken in der Tabelle hakt in der Notiz ab. Ein Fälligkeitsdatum schreibst du als `📅 2026-10-20` hinter das To-do, wie in Obsidian.
- **KI-Assistenten** können Eigenschaften lesen, Seiten danach filtern, Eigenschaften ändern und offene To-dos auflisten.

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
