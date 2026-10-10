# AGENTS.md – Arbeiten an Write

Anleitung für Menschen und KI-Agenten, die an Write arbeiten. Was die App kann und wie sie
gebaut ist, steht in der [README](README.md). Hier steht, **wie** wir daran arbeiten und was bei
jeder Änderung dazugehört.

## Was Write ist

Write ist ein Blockeditor für macOS 26+ (Electron, React, BlockNote/Tiptap), dessen Inhalte
**offene Markdown-Dateien in einem normalen Ordner** (Vault) bleiben. Es gibt keinen Server und
kein Konto. Sync läuft über iCloud, Dropbox oder Nextcloud. Die Oberfläche ist Deutsch und
Englisch, Deutsch ist die Hauptsprache.

Leitlinien für Produktentscheidungen:

- **Die Dateien sind die Wahrheit.** Index, Snapshots und Einstellungen lassen sich jederzeit
  neu aufbauen. Was der Editor nicht abbilden kann, bleibt byte-genau erhalten (verlustfreier
  Konverter in `src/shared/markdown`). Nichts einführen, was sich nicht als normales Markdown
  bzw. Frontmatter speichern lässt.
- **Kein Notion-Klon.** Wir bauen keine Datenmodelle, die Markdown sprengen. Lieber kleine
  Details mit großer Wirkung beim Schreiben (siehe 0.6.0: Link-Vorschau, Typografie, gemerkte
  Position).
- **Nichts geht verloren.** Speichern ist atomar, Konflikte werden gezeigt statt überschrieben,
  destruktive Aktionen bieten „Rückgängig“ im Toast an, statt vorher zu fragen.
- **Mac-typisch.** Native Menüleiste, Tastenkürzel aus einer zentralen Keymap, Liquid Glass,
  `prefers-reduced-motion`/`-transparency`/`-contrast` werden berücksichtigt.
- **Datenschutz.** Keine Telemetrie. Die einzige Verbindung nach außen ist die Update-Prüfung,
  und die nur mit Zustimmung. Neue Netzwerkzugriffe nur nach Rücksprache.

## Aufbau in Kürze

```
src/main/       Main-Prozess: Vault, Dateien, Watcher, Papierkorb, Git-Snapshots, Menü, Fenster
src/indexer/    utilityProcess: SQLite + FTS5
src/mcp/        MCP-Server für KI-Assistenten
src/preload/    typisierte Bridge (window.docu) – einziger Weg vom Renderer zum Main-Prozess
src/renderer/   React-Oberfläche; editor/ = BlockNote-Schema und Erweiterungen, help/ = Hilfe
src/shared/     gemeinsamer Code: IPC-Vertrag (zod), Markdown, Frontmatter, Keymap, Texte
tests/unit/     Vitest
tests/e2e/      Playwright gegen die gebaute App
```

## Code-Praktiken

- **Lies den Code drumherum und schreib wie er.** Benennung, Kommentardichte und Idiome folgen
  dem bestehenden Code, nicht persönlichen Vorlieben.
- **Clean Code, pragmatisch:** kleine Funktionen mit einer Aufgabe, sprechende Namen, keine
  toten Pfade, keine vorsorglichen Abstraktionen. Drei ähnliche Zeilen sind besser als eine
  verfrühte Abstraktion. Reine Logik (Parsen, Ersetzen, Rechnen) gehört in Funktionen ohne
  DOM/Electron, damit sie testbar ist, z. B. `smartReplacement()` in `editor/typing.ts`.
- **Kommentare auf Englisch** und nur für das _Warum_ (Randfälle, Browser-Eigenheiten,
  Entscheidungen), nicht für das, was der Code ohnehin sagt.
- **TypeScript strict**, kein `any` ohne Grund. Typen aus `src/shared/types.ts` wiederverwenden.
- **Format:** Prettier (`singleQuote`, ohne Semikolon, `printWidth` 100). ESLint inkl.
  `react-hooks`.
- **Sicherheit:** Jeder IPC-Aufruf wird in `src/shared/ipc.ts` mit zod geprüft, jeder Pfad gegen
  den Vault-Ordner. Kein `nodeIntegration`, die CSP bleibt strikt. Neue IPC-Kanäle immer mit
  Schema.
- **Abhängigkeiten:** Versionen exakt pinnen. Neue Pakete nur, wenn es sich wirklich lohnt.
  Lizenzen müssen GPL-3.0-kompatibel sein (`scripts/third-party-licenses.ts`).
- **Barrierefreiheit:** `aria-label` an Bedienelementen ohne Text, Fokus sichtbar halten, Motion
  über `lib/motion.ts` (`scrollBehavior()`), damit reduzierte Bewegung respektiert wird.

## Tests

| Ebene                                | Wann                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| Unit (`npm test`)                    | Für jede neue reine Logik und jeden behobenen Fehler, der sich so prüfen lässt   |
| Roundtrip (`tests/unit/*roundtrip*`) | Jede Änderung am Markdown-Konverter: Laden und Speichern muss byte-genau bleiben |
| E2E (`npm run test:e2e`)             | Neue zentrale Abläufe; läuft immer in CI                                         |
| Perf (`npm run test:perf`)           | Änderungen an Index, Baum oder Suche                                             |

- **Abdeckung:** Neue Logik bekommt Tests. Ziel sind sinnvolle Fälle, keine Prozentzahl: der
  Normalfall, die Randfälle und das, was ausdrücklich _nicht_ passieren darf (z. B. `---` wird
  nicht zum Gedankenstrich).
- **Testnamen auf Deutsch**, als Satz über das Verhalten („macht aus -- zwischen Leerzeichen
  einen Gedankenstrich“).
- **Kleine Fixes:** Typecheck, Lint und Unit-Tests reichen lokal. Die E2E-Suite muss nicht bei
  jeder Kleinigkeit laufen, CI übernimmt das.
- Zum Ausprobieren in der echten App: `npm run build`, dann Playwright mit
  `WRITE_VAULT`/`WRITE_USER_DATA` auf einen Wegwerf-Ordner (Beispiel: `scripts/shot-ui.mjs`).
  Niemals gegen den echten Vault oder die echten Einstellungen testen.

## Checkliste bei jeder Änderung

1. **Code** im Stil des Umfelds, Logik testbar herausgezogen.
2. **Tests** ergänzt (siehe oben).
3. **Texte in beiden Sprachen:** Jeder sichtbare Text kommt aus
   `src/shared/locales/de.json` **und** `en.json`. Keine fest verdrahteten Strings in der UI.
4. **Hilfe anpassen**, wenn sich etwas für Nutzer ändert: `src/renderer/src/help/content.de.ts`
   **und** `content.en.ts` (beide müssen jedes Thema abdecken, der Typecheck prüft das). Neue
   Themen in `help/model.ts` eintragen, Suchwörter unter `keywords` ergänzen.
   `tests/unit/help.test.ts` prüft Befehle, Themen-Links und Beispiele.
5. **Changelog:** Für Nutzer sichtbare Änderungen kommen in `CHANGELOG.md` in den Abschnitt der
   kommenden Version (siehe unten).
6. **Neue Einstellung?** An allen Stellen nachziehen: `AppSettings` in `src/shared/types.ts`,
   Standardwert in `src/main/settings.ts`, zod-Schema in `src/shared/ipc.ts`, Schalter in
   `SettingsSheet.tsx`, Texte in beiden Locales, Hilfe-Thema „Einstellungen“.
7. **Neuer Befehl/Tastenkürzel?** Nur über `src/shared/keymap.ts` (daraus entstehen Menü und
   Palette). Kürzel nicht mit macOS-Standards oder vorhandenen Kürzeln kollidieren lassen.
   Ausführung in `src/renderer/src/commands.ts`.
8. **Prüfen:** `npm run typecheck`, `npm run lint`, `npx prettier --check <geänderte Dateien>` (einige Konfigurationsdateien sind
   noch nicht formatiert), `npm test`.
9. **README** nur anfassen, wenn sich Architektur, Datenmodell oder Abläufe ändern.

## Changelog und Versionen

- `CHANGELOG.md` ist für **Menschen, die Write benutzen**, nicht für Entwickler: Deutsch, in
  der Du-Form, Nutzen statt Implementierung. Gliederung `### Neu`, `### Verbessert`,
  `### Behoben`. Der Text wird zum GitHub-Release und erscheint nach dem Update einmal in der
  App.
- Jede Version hat einen Abschnitt `## x.y.z – JJJJ-MM-TT`, neueste oben. Die Version in
  `package.json` (und `package-lock.json`, `npm version x.y.z --no-git-tag-version`) muss dazu
  passen.
- **Achtung:** Ein Push auf `main` mit einer noch nicht veröffentlichten Version in
  `package.json` **baut, signiert und veröffentlicht automatisch ein Release** (CI-Job
  `release`). Version nur erhöhen, wenn das gewollt ist, und nicht ohne Rückfrage pushen.

## Git

- Commit-Nachrichten auf Deutsch, kurz und inhaltlich („Link-Vorschau beim Hovern“).
  Release-Commits heißen `x.y.z: Stichworte`.
- Nur committen oder pushen, wenn darum gebeten wurde.

## Ideen und offene Punkte

Ideen, die zur Leitlinie „kleine Details, große Wirkung“ passen, werden hier gesammelt, bis sie
umgesetzt oder verworfen sind:

- Positionen (Scroll/Cursor) über einen Neustart hinweg merken (derzeit nur pro Sitzung).
- Link-Vorschau auch in der Markdown-Vorschau und bei Backlinks.
- Typewriter-Scrolling optional auch außerhalb des Fokusmodus.
