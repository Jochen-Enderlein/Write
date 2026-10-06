import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let app: ElectronApplication
let win: Page
let vault: string

const read = (rel: string): string => readFileSync(path.join(vault, rel), 'utf8')

async function eventually(fn: () => void, timeout = 8000): Promise<void> {
  await expect
    .poll(
      () => {
        try {
          fn()
          return true
        } catch {
          return false
        }
      },
      { timeout }
    )
    .toBe(true)
}

/** The app opens the main window and a hidden Quick Capture panel; pick the main one. */
async function mainWindow(app: ElectronApplication): Promise<Page> {
  const isMain = (w: Page): boolean => !w.url().includes('capture')
  const found = app.windows().find(isMain)
  if (found) return found
  for (;;) {
    const w = await app.waitForEvent('window')
    if (isMain(w)) return w
  }
}

test.beforeAll(async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'write-e2e-'))
  vault = path.join(root, 'Vault')
  mkdirSync(vault)
  writeFileSync(
    path.join(vault, 'Ziel.md'),
    '---\nid: 01TESTZIEL0000000000000000\ntitle: Ziel\ncreated: 2026-10-05T10:00:00+02:00\nupdated: 2026-10-05T10:00:00+02:00\n---\n\nDas Ziel enthält das Wort Zitronenfalter.\n'
  )
  writeFileSync(
    path.join(vault, 'Quelle.md'),
    '# Quelle\n\nVerweis auf [[Ziel]] und [[Ziel|das Ziel]].\n'
  )
  // The UI language follows the system by default; the tests read German labels
  mkdirSync(path.join(root, 'userdata'))
  writeFileSync(
    path.join(root, 'userdata', 'settings.json'),
    JSON.stringify({ settings: { language: 'de' } })
  )
  writeFileSync(
    path.join(vault, 'Abschnitte.md'),
    '# Abschnitte\n\nZu [[Anker#Details]] und [[Fehlt#X]].\n'
  )
  writeFileSync(
    path.join(vault, 'Anker.md'),
    '---\nid: 01TESTANKER000000000000000\ntitle: Anker\n---\n\n## Details\n\nText im Anker.\n'
  )
  app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      WRITE_VAULT: vault,
      WRITE_USER_DATA: path.join(root, 'userdata'),
      WRITE_NO_UPDATES: '1'
    }
  })
  win = await mainWindow(app)
  await win.waitForSelector('.tree-row')
})

test.afterAll(async () => {
  await app?.close()
})

test('öffnet eine Seite, ohne die Datei zu verändern', async () => {
  const before = read('Quelle.md')
  await win.locator('.tree-row .name', { hasText: 'Quelle' }).click()
  await expect(win.locator('.page-title')).toHaveValue('Quelle')
  await expect(win.locator('.wikilink').first()).toHaveText('Ziel')
  await win.waitForTimeout(1200)
  expect(read('Quelle.md')).toBe(before)
})

test('legt eine Seite an, bearbeitet sie und speichert Markdown', async () => {
  await win.getByRole('button', { name: 'Neue Seite', exact: true }).click()
  const title = win.locator('.page-title')
  await expect(title).toBeFocused()
  await title.fill('Neue Notiz')
  await title.press('Enter')
  await eventually(() => expect(existsSync(path.join(vault, 'Neue Notiz.md'))).toBe(true))

  await win.keyboard.type('Erster Absatz mit Text.')
  await win.keyboard.press('Enter')
  await win.keyboard.type('- Punkt eins')
  await eventually(() => {
    const text = read('Neue Notiz.md')
    expect(text).toMatch(/^---\nid: \w+\ntitle: Neue Notiz\n/)
    expect(text).toContain('Erster Absatz mit Text.\n\n- Punkt eins\n')
  })
})

test('setzt einen Wiki-Link über die [[-Autovervollständigung', async () => {
  await win.keyboard.press('Enter')
  await win.keyboard.press('Enter')
  await win.keyboard.type('Siehe [[Zie')
  await win.locator('.bn-suggestion-menu-item', { hasText: 'Ziel' }).first().click()
  await eventually(() => expect(read('Neue Notiz.md')).toContain('Siehe [[Ziel]]'))
})

test('markiert Text wie mit einem Textmarker', async () => {
  // Typing the markers marks as you go
  await win.keyboard.press('Enter')
  await win.keyboard.type('Ganz ==wichtig== hier')
  await eventually(() => expect(read('Neue Notiz.md')).toContain('Ganz ==wichtig== hier'))
  await expect(win.locator('.write-editor mark', { hasText: 'wichtig' })).toBeVisible()

  // ⌃⌘H marks the selection
  await win.keyboard.press('Enter')
  await win.keyboard.type('Auch das')
  await win.keyboard.press('Meta+Shift+ArrowLeft')
  // The editor takes over the selection asynchronously; its toolbar shows once it has
  const button = win.locator('.bn-formatting-toolbar [data-test="highlight"]')
  await expect(button).toBeVisible()
  await win.keyboard.press('Control+Meta+H')
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await eventually(() => expect(read('Neue Notiz.md')).toContain('\n==Auch das==\n'))
})

test('findet Text über die Volltextsuche', async () => {
  await win.locator('.sidebar-item', { hasText: 'Suchen' }).click()
  await win.locator('.search-field input').fill('zitronen')
  const hit = win.locator('.result', { hasText: 'Ziel' })
  await expect(hit).toBeVisible()
  await expect(hit.locator('mark')).toHaveText(/Zitronenfalter/i)
  await hit.click()
  await expect(win.locator('.page-title')).toHaveValue('Ziel')
})

test('benennt um und passt alle Links an', async () => {
  const title = win.locator('.page-title')
  await title.fill('Ziel Neu')
  await title.press('Enter')
  await eventually(() => {
    expect(existsSync(path.join(vault, 'Ziel Neu.md'))).toBe(true)
    expect(existsSync(path.join(vault, 'Ziel.md'))).toBe(false)
    expect(read('Quelle.md')).toBe(
      '# Quelle\n\nVerweis auf [[Ziel Neu]] und [[Ziel Neu|das Ziel]].\n'
    )
    expect(read('Neue Notiz.md')).toContain('[[Ziel Neu]]')
    expect(read('Ziel Neu.md')).toContain('title: Ziel Neu')
  })
})

test('löscht in den Papierkorb und stellt wieder her', async () => {
  await win.locator('.tree-row .name', { hasText: 'Quelle' }).click({ button: 'right' })
  await win.locator('.context-menu button', { hasText: 'In den Papierkorb' }).click()
  await eventually(() => expect(existsSync(path.join(vault, 'Quelle.md'))).toBe(false))
  expect(readdirSync(path.join(vault, '.trash')).length).toBe(1)

  await win.locator('.sidebar-item', { hasText: 'Papierkorb' }).click()
  await win
    .locator('.list-row', { hasText: 'Quelle' })
    .getByRole('button', { name: 'Wiederherstellen' })
    .click()
  await eventually(() => expect(existsSync(path.join(vault, 'Quelle.md'))).toBe(true))
  expect(read('Quelle.md')).toContain('[[Ziel Neu]]')
  await expect(win.locator('.page-title')).toHaveValue('Quelle')
})

test('lädt externe Änderungen neu', async () => {
  writeFileSync(path.join(vault, 'Quelle.md'), '# Quelle\n\nExtern geändert.\n')
  await expect(win.locator('.bn-editor')).toContainText('Extern geändert.')
})

test('legt Ordner ohne Rechtsklick an, benennt sie um und füllt sie', async () => {
  await win.getByRole('button', { name: 'Neuer Ordner' }).click()
  const input = win.locator('.tree-row input')
  await expect(input).toBeFocused()
  await input.fill('Archiv')
  await input.press('Enter')
  await eventually(() => expect(existsSync(path.join(vault, 'Archiv'))).toBe(true))

  // „+“ in der Ordnerzeile legt eine Seite darin an
  const row = win.locator('.tree-row', { hasText: 'Archiv' })
  await row.hover()
  await row.getByRole('button', { name: 'Neue Seite hier' }).click()
  await expect(win.locator('.page-title')).toBeFocused()
  await eventually(() => expect(existsSync(path.join(vault, 'Archiv', 'Unbenannt.md'))).toBe(true))

  // „⋯“ öffnet dasselbe Menü wie ein Rechtsklick
  await row.hover()
  await row.getByRole('button', { name: /Aktionen für/ }).click()
  await win.locator('.context-menu button', { hasText: 'Neuer Unterordner' }).click()
  await win.locator('.tree-row input').press('Enter')
  await eventually(() => expect(existsSync(path.join(vault, 'Archiv', 'Neuer Ordner'))).toBe(true))

  // ⌃-Klick wirkt wie ein Sekundärklick
  await win.locator('.tree-row .name', { hasText: 'Archiv' }).click({ modifiers: ['Control'] })
  await expect(win.locator('.context-menu')).toBeVisible()
  await win.keyboard.press('Escape')
})

test('zeigt beim Klick auf einen Ordner seine Übersicht', async () => {
  await win.locator('.tree-row .name', { hasText: 'Archiv' }).click()
  const view = win.locator('.folder-view')
  await expect(view.getByRole('heading', { name: 'Archiv' })).toBeVisible()
  await expect(view.locator('.folder-count')).toHaveText('1 Seite · 1 Ordner')
  await expect(view.locator('.folder-card', { hasText: 'Unbenannt' })).toBeVisible()

  // Into the subfolder and back up through the breadcrumb
  await view.locator('.folder-card', { hasText: 'Neuer Ordner' }).click()
  await expect(view.getByRole('heading', { name: 'Neuer Ordner' })).toBeVisible()
  await expect(view.locator('.folder-empty')).toBeVisible()
  await win.locator('.breadcrumb button', { hasText: 'Archiv' }).click()
  await expect(view.getByRole('heading', { name: 'Archiv' })).toBeVisible()

  // A card opens its page
  await view.locator('.folder-card', { hasText: 'Unbenannt' }).click()
  await expect(win.locator('.page-title')).toHaveValue('Unbenannt')
})

test('öffnet die Einstellungen über den Knopf und speichert Änderungen', async () => {
  await win.locator('.sidebar-item', { hasText: 'Einstellungen' }).click()
  const sheet = win.locator('.sheet')
  await expect(sheet.getByRole('heading', { name: 'Einstellungen' })).toBeVisible()
  await expect(sheet.locator('.row-title', { hasText: 'Vault' }).first()).toBeVisible()
  await sheet.getByLabel('Papierkorb automatisch leeren').selectOption('7')
  await sheet.getByRole('button', { name: 'Fertig' }).click()
  const settings = JSON.parse(
    readFileSync(path.join(path.dirname(vault), 'userdata', 'settings.json'), 'utf8')
  )
  expect(settings.settings.trashRetentionDays).toBe(7)
})

test('schaltet das Erscheinungsbild um und merkt es sich', async () => {
  const dark = (): Promise<boolean> =>
    win.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const saved = (): string =>
    JSON.parse(readFileSync(path.join(path.dirname(vault), 'userdata', 'settings.json'), 'utf8'))
      .settings.theme

  // Playwright pins prefers-color-scheme to light by default; let the app's setting show through
  await win.emulateMedia({ colorScheme: null })
  await win.locator('.sidebar-item', { hasText: 'Einstellungen' }).click()
  const themes = win.locator('.sheet').getByRole('radiogroup', { name: 'Erscheinungsbild' })
  await themes.getByRole('radio', { name: 'Dunkel' }).click()
  await expect.poll(dark).toBe(true)
  expect(saved()).toBe('dark')
  await themes.getByRole('radio', { name: 'Hell' }).click()
  await expect.poll(dark).toBe(false)
  await expect(themes.getByRole('radio', { name: 'Hell' })).toHaveAttribute('aria-checked', 'true')
  await win.keyboard.press('Escape')

  // The menu command flips to the opposite of what is showing
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => !w.webContents.getURL().includes('capture'))!
      .webContents.send('menu:command', 'view.theme')
  )
  await expect.poll(dark).toBe(true)
  await eventually(() => expect(saved()).toBe('dark'))

  await app.evaluate(({ nativeTheme }) => (nativeTheme.themeSource = 'system'))
})

test('zeigt die Neuerungen und antwortet auf „Nach Updates suchen“', async () => {
  const send = (id: string): Promise<void> =>
    app.evaluate(
      ({ BrowserWindow }, cmd) =>
        BrowserWindow.getAllWindows()
          .find((w) => !w.webContents.getURL().includes('capture'))!
          .webContents.send('menu:command', cmd),
      id
    )
  await send('help.whatsNew')
  const sheet = win.locator('.sheet')
  await expect(sheet.getByRole('heading', { name: 'Neuerungen in Write' })).toBeVisible()
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
  await expect(sheet.locator('.release h3').first()).toContainText(`Version ${version}`)
  await expect(sheet.locator('.release li', { hasText: 'Textmarker' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Fertig' }).click()

  // Development builds have no updater, but the click still gets an answer
  await send('update.check')
  await expect(win.locator('.toast')).toContainText('Updates gibt es nur in der installierten App.')
})

test('sucht nur mit Erlaubnis automatisch nach Updates', async () => {
  const saved = (): string =>
    JSON.parse(readFileSync(path.join(path.dirname(vault), 'userdata', 'settings.json'), 'utf8'))
      .settings.autoUpdates
  await win.locator('.sidebar-item', { hasText: 'Einstellungen' }).click()
  const sheet = win.locator('.sheet')
  const toggle = sheet.getByRole('switch', { name: 'Automatisch nach Updates suchen' })
  await expect(toggle).not.toBeChecked()
  await expect(sheet.getByRole('link', { name: 'Impressum' })).toHaveAttribute(
    'href',
    'https://beerball.jochens-toller-server.de/impressum'
  )
  await expect(sheet.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute(
    'href',
    'https://github.com/Jochen-Enderlein/Write/blob/main/DATENSCHUTZ.md'
  )
  await toggle.click()
  await eventually(() => expect(saved()).toBe('on'))
  await toggle.click()
  await eventually(() => expect(saved()).toBe('off'))
  await win.keyboard.press('Escape')
})

test('liefert die Lizenzen der Bibliotheken mit und rendert Diagramme ohne ELK', async () => {
  await win.locator('.sidebar-item', { hasText: 'Einstellungen' }).click()
  await win.locator('.sheet').getByRole('button', { name: 'Lizenzen von Drittanbietern' }).click()
  const pre = win.locator('.licenses pre')
  await expect(pre).toContainText('@blocknote/core')
  await expect(pre).not.toContainText('elkjs')
  await win.keyboard.press('Escape')

  // Mermaid's default layout still works although elkjs (EPL-2.0) is left out
  writeFileSync(
    path.join(vault, 'Diagramm.md'),
    '# Diagramm\n\n```mermaid\ngraph TD\n  A --> B\n```\n'
  )
  await win.locator('.tree-row .name', { hasText: 'Diagramm' }).click()
  await expect(win.locator('.mermaid-preview svg')).toBeVisible({ timeout: 15000 })
})

test('zeigt alle Tastaturkurzbefehle und filtert sie', async () => {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => !w.webContents.getURL().includes('capture'))!
      .webContents.send('menu:command', 'shortcuts.show')
  )
  const sheet = win.locator('.sheet')
  await expect(sheet.getByRole('heading', { name: 'Tastaturkurzbefehle' })).toBeVisible()
  await expect(sheet.locator('.shortcut-row', { hasText: 'Kursiv' }).locator('kbd')).toHaveText(
    '⌘I'
  )
  await expect(
    sheet.locator('.shortcut-row', { hasText: 'Seiteninfos' }).locator('kbd')
  ).toHaveText('⌥⌘I')
  await sheet.getByPlaceholder('Kurzbefehl suchen …').fill('ordner')
  await expect(sheet.locator('.shortcut-row')).toHaveCount(1)
  await expect(sheet.locator('.shortcut-row kbd')).toHaveText('⇧⌘N')
  await win.keyboard.press('Escape')
})

test('fährt die Seitenleiste ein und aus, ohne dass Knöpfe in der Ziehfläche liegen', async () => {
  // Buttons in a window drag region swallow real mouse clicks on macOS
  const inDragRegion = await win.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null)
      .filter((b) => {
        // app-region is not inherited: the nearest element that sets it decides
        for (let el: Element | null = b; el; el = el.parentElement) {
          const region = getComputedStyle(el).getPropertyValue('-webkit-app-region')
          if (region === 'drag') return true
          if (region === 'no-drag') return false
        }
        return false
      })
      .map((b) => b.getAttribute('aria-label') ?? b.title ?? b.textContent)
  )
  expect(inDragRegion).toEqual([])

  const width = (): Promise<number> =>
    win.evaluate(() => document.querySelector('.sidebar')!.getBoundingClientRect().width)
  await win.locator('.sidebar-titlebar .icon-button').click()
  await expect.poll(width).toBe(0)
  await win.locator('.toolbar .icon-button[title^="Seitenleiste"]').click()
  await expect.poll(width).toBeGreaterThan(200)
})

test('löscht Seiten mit ⌫ im Baum und widerruft über die Meldung', async () => {
  await win.getByRole('button', { name: 'Neue Seite', exact: true }).click()
  await win.locator('.page-title').fill('Wegwerfseite')
  await win.locator('.page-title').press('Enter')
  await eventually(() => expect(existsSync(path.join(vault, 'Wegwerfseite.md'))).toBe(true))

  await win.locator('.tree-row .name', { hasText: 'Wegwerfseite' }).click()
  await win.keyboard.press('Backspace')
  await eventually(() => expect(existsSync(path.join(vault, 'Wegwerfseite.md'))).toBe(false))
  const toast = win.locator('.toast')
  await expect(toast).toContainText('„Wegwerfseite“ in den Papierkorb gelegt')
  await toast.getByRole('button', { name: 'Widerrufen' }).click()
  await eventually(() => expect(existsSync(path.join(vault, 'Wegwerfseite.md'))).toBe(true))
  await expect(win.locator('.page-title')).toHaveValue('Wegwerfseite')
})

test('löscht Ordner samt Inhalt über das ⋯-Menü und stellt sie aus dem Papierkorb wieder her', async () => {
  const row = win.locator('.tree-row', { hasText: 'Archiv' }).first()
  await row.hover()
  await row.getByRole('button', { name: /Aktionen für/ }).click()
  await win.locator('.context-menu button', { hasText: 'In den Papierkorb' }).click()
  await eventually(() => expect(existsSync(path.join(vault, 'Archiv'))).toBe(false))
  await expect(win.locator('.tree-row', { hasText: 'Archiv' })).toHaveCount(0)

  await win.locator('.sidebar-item', { hasText: 'Papierkorb' }).click()
  const entry = win.locator('.list-row', { hasText: 'Archiv' })
  await expect(entry).toContainText('Ordner')
  await entry.getByRole('button', { name: 'Wiederherstellen' }).click()
  await eventually(() => expect(existsSync(path.join(vault, 'Archiv', 'Unbenannt.md'))).toBe(true))
  await expect(win.locator('.tree-row', { hasText: 'Archiv' }).first()).toBeVisible()
})

/** Sends a menu command to the main window, like choosing it in the menu bar. */
async function command(id: string): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, cmd) =>
      BrowserWindow.getAllWindows()
        .find((w) => !w.webContents.getURL().includes('capture'))!
        .webContents.send('menu:command', cmd),
    id
  )
}

test('sucht und ersetzt in der Seite', async () => {
  await win.locator('.tree-row .name', { hasText: 'Quelle' }).click()
  await expect(win.locator('.page-title')).toHaveValue('Quelle')
  await command('find.replace')
  const bar = win.locator('.find-bar')
  // An earlier test replaced the file with "Extern geändert."
  await bar.getByPlaceholder('In Seite suchen').fill('Extern')
  await expect(bar.locator('.find-count')).toHaveText('1 von 1')
  await bar.getByPlaceholder('Ersetzen durch').fill('Intern')
  await bar.getByRole('button', { name: 'Alle ersetzen' }).click()
  await expect(bar.locator('.find-count')).toHaveText('Keine Treffer')
  await eventually(() => expect(read('Quelle.md')).toContain('Intern geändert.'))
  await bar.getByPlaceholder('In Seite suchen').press('Escape')
  await expect(bar).toHaveCount(0)
})

test('zeigt Abschnitts-Links als vorhanden und mit Abschnitt an', async () => {
  await win.locator('.tree-row .name', { hasText: 'Abschnitte' }).click()
  const links = win.locator('.wikilink')
  await expect(links.first()).toHaveText('Anker › Details')
  await expect(links.first()).not.toHaveClass(/missing/)
  await expect(links.nth(1)).toHaveClass(/missing/)
})

test('setzt Seitensymbol und Tags im Frontmatter', async () => {
  await win.locator('.tree-row .name', { hasText: 'Anker' }).click()
  await expect(win.locator('.page-title')).toHaveValue('Anker')
  await win.locator('.page-title').hover()
  await win.getByRole('button', { name: 'Symbol hinzufügen' }).click()
  await win.locator('.icon-grid button', { hasText: '🚀' }).click()
  await eventually(() => expect(read('Anker.md')).toMatch(/\nicon: 🚀\n/))
  await win.getByRole('button', { name: 'Tag hinzufügen' }).click()
  await win.getByLabel('Tag hinzufügen').fill('Projekt')
  await win.getByLabel('Tag hinzufügen').press('Enter')
  await eventually(() =>
    expect(read('Anker.md')).toMatch(/\ntags:\n {2}- projekt\n|\ntags: \[projekt\]\n/)
  )
  // The body stays untouched
  expect(read('Anker.md')).toContain('\n## Details\n\nText im Anker.\n')
})

test('öffnet das Journal ohne doppelten Titel', async () => {
  await win.locator('.sidebar-item', { hasText: 'Heute' }).click()
  await expect(win.locator('.journal-bar')).toBeVisible()
  await expect(win.locator('.write-editor h1')).toHaveCount(0)
  await win.getByRole('button', { name: 'Kalender' }).click()
  await expect(win.locator('.calendar-day.current')).toBeVisible()
  await win.keyboard.press('Escape')
})

test('speichert eben Getipptes auch beim sofortigen Schließen des Fensters', async () => {
  await win.locator('.tree-row .name', { hasText: 'Quelle' }).click()
  await expect(win.locator('.page-title')).toHaveValue('Quelle')
  await win.locator('.bn-editor').click()
  await win.keyboard.press('End')
  await win.keyboard.type(' Zuletzt getippt.')
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => !w.webContents.getURL().includes('capture'))!
      .close()
  )
  await eventually(() => expect(read('Quelle.md')).toContain('Zuletzt getippt.'))
})
