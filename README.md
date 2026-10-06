# Write

**Write** (`com.jochenenderlein.write`) ist ein Notion-artiger Blockeditor für macOS 26+, dessen Inhalte offene Markdown-Dateien in einem normalen Ordner (Vault) bleiben. Sync läuft über iCloud, Dropbox oder Nextcloud – die App braucht keinen Server.

## Einrichtung

Voraussetzungen: macOS 26 (Tahoe) oder neuer, Apple Silicon, Node.js ≥ 22 (`brew install node`).

```bash
npm install
```

npm 11 blockiert Installationsskripte standardmäßig. Freigegeben sind `better-sqlite3` und `esbuild`. Falls `npm install` warnt:

```bash
npm install-scripts approve better-sqlite3 esbuild
```

## Skripte

| Befehl                                    | Zweck                                                        |
| ----------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                             | App mit Hot Reload starten                                   |
| `npm run build`                           | Main, Preload, Index-Prozess und Renderer nach `out/` bauen  |
| `npm test`                                | Unit-Tests (Roundtrip, Serialisierung, Vault, Index)         |
| `npm run test:e2e`                        | Build + Playwright-E2E gegen die echte App                   |
| `npm run test:perf`                       | Performance mit generierten Vaults (5.000 und 20.000 Seiten) |
| `npm run ci`                              | Typecheck, Lint, Unit- und E2E-Tests                         |
| `npm run dist`                            | Signierter, notarisierter DMG/ZIP-Build (siehe unten)        |
| `npm run generate-vault -- <Ordner> 5000` | Test-Vault erzeugen                                          |

Für Tests und Entwicklung: `WRITE_VAULT=<Ordner>` öffnet beim Start direkt diesen Vault, `WRITE_USER_DATA=<Ordner>` trennt Einstellungen und Index von der normalen Installation.

## Architektur

```
src/
├── main/        Main-Prozess: Vault, Dateien, Watcher, Papierkorb, Git-Snapshots, Menü, Fenster
├── indexer/     utilityProcess: SQLite + FTS5 (Seiten, Links, Tags, Volltext)
├── preload/     Typisierte Bridge (window.docu) – einziger Weg vom Renderer zum Main-Prozess
├── renderer/    React-Oberfläche: Editor, Seitenbaum, Palette, Ansichten, Quick Capture
└── shared/      Gemeinsamer Code: IPC-Vertrag (zod), Markdown-Konverter, Frontmatter, Keymap, Texte
```

- **Die Dateien sind die Wahrheit.** Index (`index.sqlite`) und Snapshot-Repo (`git/`) liegen pro Vault unter `~/Library/Application Support/Write/vaults/<vault-id>/` und lassen sich jederzeit neu aufbauen (Menü _Ablage → Index neu aufbauen_).
- **Verlustfreies Markdown** (`src/shared/markdown`): Beim Laden merkt sich der Editor für jeden Block die Originalstelle in der Datei. Unveränderte Blöcke werden byte-genau zurückgeschrieben, nur geänderte Blöcke neu serialisiert. Was der Editor nicht abbilden kann (HTML, Fußnoten, Setext-Überschriften, Referenz-Links …), bleibt als „Markdown“-Block bzw. Inline-Rohtext unverändert erhalten. Farben, Unterstreichung, Ausrichtung und Toggle-Listen sind im Editor bewusst deaktiviert, weil Markdown sie nicht abbildet. Der Textmarker wird wie in Obsidian als `==markiert==` gespeichert (⌃⌘H, Toolbar oder direkt tippen); ein wörtliches `==`, das als Marker gelesen würde, wird als `\==` geschrieben.
- **Nichts geht beim Schließen verloren:** Vor dem Schließen eines Fensters und vor dem Beenden fordert der Main-Prozess jedes Fenster auf, ausstehende Änderungen zu speichern (`app:flush` → `app:flushed`, höchstens 4 s).
- **Sicherheit:** `contextIsolation`, Sandbox, kein `nodeIntegration`, strikte CSP, jeder IPC-Aufruf wird mit zod geprüft, alle Pfade werden gegen den Vault-Ordner geprüft. Bilder lädt der Renderer über das Protokoll `vault-asset://`.
- **Liquid Glass:** natives Glas über `electron-liquid-glass` hinter `GlassService` (`src/main/glass.ts`), Fallback auf Vibrancy. Schwebende Elemente (Palette, Sheets, Menüs, Toolbar) nutzen CSS-Glas. `prefers-reduced-motion`, `prefers-reduced-transparency` und `prefers-contrast` werden berücksichtigt.

## Datenmodell

```
Vault/
├── .docuapp/vault.json      ID, Name, Favoriten, Reihenfolge im Seitenbaum (wird gesynct)
├── .docuapp/templates/      Vorlagen mit {{title}}, {{date}}, {{time}}, {{weekday}}
├── .trash/                  Papierkorb (wird gesynct, Leerung nach 30 Tagen)
├── Journal/2026-10-05.md
├── Projekte.md
└── Projekte/                Unterseiten und _assets/ von „Projekte“
```

Callouts im Obsidian-Format (`> [!note] Titel`), Wiki-Links `[[Titel]]` / `[[Titel|Text]]` / `[[Titel#Abschnitt]]` / `[[Ordner/Titel]]`, Einbettungen `![[Bild.png]]` und `![[Seite#Abschnitt]]`, Seitensymbol (`icon:`) und Tags im Frontmatter, Tags auch als `#tag`.

## Stand Version 0.1

| Meilenstein              | Stand                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Grundgerüst           | ✅ electron-vite, React, TS strict, ESLint/Prettier, zod-IPC, Glasfenster, i18n, Tests                                                                                                                                                                                                                                                  |
| M1 Vault und Editor      | ✅ Vaults, virtualisierter Baum, verlustfreier Konverter + Roundtrip-Suite, atomares Speichern, Anlegen/Umbenennen/Verschieben/Löschen, Bilder & Anhänge, Shiki, Mermaid, Watcher, Konfliktkopien, iCloud-Platzhalter                                                                                                                   |
| M2 Index, Suche, Links   | ✅ SQLite/FTS5 im utilityProcess, inkrementell, `[[`-Autovervollständigung, Link-Anpassung beim Umbenennen, Backlinks, Volltext mit Treffern, Tags                                                                                                                                                                                      |
| M3 Schnellerfassung      | ✅ Command Palette (⌘K/⌘P), zentrale Keymap + Menüleiste, Journal „Heute“, Quick Capture (⌃⌥Leertaste)                                                                                                                                                                                                                                  |
| M4 Historie und Vorlagen | ✅ Git-Snapshots mit Diff/Wiederherstellen, Papierkorb-Ansicht, Vorlagen, electron-builder/-updater. ⏳ Signierung und Notarisierung brauchen den Developer-Account                                                                                                                                                                     |
| 0.2 Schreiben und Ordnen | ✅ Suchen und Ersetzen (⌘F/⌥⌘F), Gliederung, Fokusmodus, Wortzahl, Schrift/Größe/Zeilenbreite, Seitensymbol und Tags bearbeiten, Journal-Navigation mit Kalender, manuelle Reihenfolge und Ordner verschieben, nicht verlinkte Erwähnungen, mehrere Fenster, Export als PDF/HTML und Drucken, Aufbewahrungsfrist der Historie, Englisch |

Gemessen auf Apple Silicon (`npm run test:perf`, `scripts/measure-startup.mjs`):

|                                              | 5.000 Seiten | 20.000 Seiten |
| -------------------------------------------- | ------------ | ------------- |
| Seitenbaum                                   | 14 ms        | 39 ms         |
| Erstindexierung (Hintergrund)                | 0,75 s       | 3,2 s         |
| Volltextsuche (langsamste Abfrage)           | 6 ms         | 20 ms         |
| App-Start bis erste Seite (kalt, Index leer) | 0,87 s       | –             |

## Release-Build

```bash
export APPLE_ID=… APPLE_APP_SPECIFIC_PASSWORD=… APPLE_TEAM_ID=…
npm run dist
```

Signiert wird mit dem Developer-ID-Zertifikat aus dem Schlüsselbund.

Veröffentlichen: `npm run release` baut, signiert, notarisiert und lädt DMG und ZIP als Release auf [GitHub](https://github.com/Jochen-Enderlein/Write/releases) hoch. Dafür braucht es ein GitHub-Token mit Schreibrecht auf das Repo (`GH_TOKEN`); vorher die Version in `package.json` erhöhen. Installierte Apps finden das Update über `electron-updater` selbst. Ohne Zertifikat geht ein unsignierter Testbuild:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --dir -c.mac.notarize=false
```

## Abweichungen vom Plan

- **Dateiüberwachung:** statt chokidar ein rekursiver `fs.watch` (ein FSEvents-Stream für den ganzen Vault). chokidar 5 legt pro Ordner einen Watcher an, das skaliert bei tausenden Ordnern schlecht. Eigene Schreibvorgänge erkennt die App am Inhalts-Hash, nicht über ein Zeitfenster.
- **Mermaid** ist ein eigener Block (Diagramm, Quelltext beim Bearbeiten), gespeichert als normaler ` ```mermaid `-Block.
- **Code-Sprachen:** Aliase wie `ts` oder `bash` werden auf die kanonische Sprache abgebildet. Code in Sprachen, die der Editor nicht kennt, bleibt als unveränderter Markdown-Block erhalten.
- **Versionen:** TypeScript 6.0 und Vite 7, weil typescript-eslint bzw. electron-vite 5 die neuesten Hauptversionen noch nicht unterstützen.

## Offene Punkte

- [ ] Developer-Account für Signierung und Notarisierung
- [ ] Nur Apple Silicon oder auch Intel (derzeit nur arm64)
- [ ] `.docuapp/` bleibt aus Kompatibilität mit bestehenden, gesyncten Vaults so benannt; eine Umbenennung bräuchte eine Migration auf allen Geräten

## Datenschutz

Write sendet keine Daten an den Entwickler, es gibt weder Konto noch Telemetrie. Notizen, Index und Versionsgeschichte bleiben auf deinem Mac bzw. in dem Ordner, den du selbst synchronisierst.

Die einzige Verbindung ins Internet ist die Update-Prüfung bei [GitHub Releases](https://github.com/Jochen-Enderlein/Write/releases). Dabei sieht GitHub die IP-Adresse und die Write-Version. Automatisch (einmal täglich) prüft Write nur, wenn du es erlaubst – gefragt wird einmal beim zweiten Start, ändern lässt es sich jederzeit unter _Einstellungen → Über Write_. _Write → Nach Updates suchen …_ prüft nur auf deinen Klick.

## Impressum

Anbieter von Write: siehe [Impressum](https://beerball.jochens-toller-server.de/impressum).

## Lizenz

Write steht unter der [GNU General Public License v3.0 oder später](LICENSE). Du darfst es nutzen, verändern und weitergeben – wer eine veränderte Fassung veröffentlicht, muss ihren Quellcode ebenfalls unter der GPL offenlegen.
