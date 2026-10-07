# Neuerungen in Write

Jede Version bekommt hier einen Abschnitt `## x.y.z – Datum`, neueste oben. `npm run release`
veröffentlicht nur, wenn der Abschnitt zur Version in `package.json` existiert. Der Text wird
zum GitHub-Release und erscheint nach dem Update einmal in der App. Geschrieben für Menschen,
die Write benutzen – nicht für Entwickler.

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
