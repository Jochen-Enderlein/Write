// Generates a test vault: node scripts/generate-vault.mjs <target-dir> [pages=5000]
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [target, countArg] = process.argv.slice(2)
if (!target) {
  console.error('Aufruf: node scripts/generate-vault.mjs <Zielordner> [Seitenzahl]')
  process.exit(1)
}
const count = Number(countArg ?? 5000)
const words =
  'Projekt Planung Markdown Notiz Besprechung Entwurf Architektur Index Suche Electron Editor Vault Ordner Datei Synchronisation Konflikt Version Vorlage Journal Aufgabe Idee Zusammenfassung Analyse Konzept Prototyp'.split(
    ' '
  )
let seed = 42
const rand = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n
const pick = () => words[rand(words.length)]
const sentence = () => Array.from({ length: 8 + rand(12) }, pick).join(' ') + '.'

const titles = Array.from({ length: count }, (_, i) => `${pick()} ${i + 1}`)
const folders = Array.from({ length: Math.ceil(count / 50) }, (_, i) => `Bereich ${i + 1}`)
mkdirSync(target, { recursive: true })
for (let i = 0; i < count; i++) {
  const folder = folders[Math.floor(i / 50)]
  const parent = i % 10 === 0 ? '' : titles[i - (i % 10)]
  const dir = path.join(target, folder, parent)
  mkdirSync(dir, { recursive: true })
  const links = Array.from({ length: 3 }, () => `[[${titles[rand(count)]}]]`).join(', ')
  const body = [
    `# ${titles[i]}`,
    '',
    sentence() + ' ' + sentence(),
    '',
    `Verwandt: ${links} #${pick().toLowerCase()}`,
    '',
    '- [ ] ' + sentence(),
    '- [x] ' + sentence(),
    '',
    '> [!note] Hinweis',
    '> ' + sentence(),
    '',
    '```js',
    `console.log(${i})`,
    '```',
    '',
    sentence().repeat(3)
  ].join('\n')
  const fm = `---\nid: GEN${String(i).padStart(23, '0')}\ntitle: ${titles[i]}\ncreated: 2026-10-05T12:00:00+02:00\nupdated: 2026-10-05T12:00:00+02:00\ntags: [${pick().toLowerCase()}]\n---\n\n`
  writeFileSync(path.join(dir, `${titles[i]}.md`), fm + body + '\n')
}
console.log(`${count} Seiten in ${target} erzeugt`)
