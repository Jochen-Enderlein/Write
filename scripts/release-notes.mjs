// Writes the CHANGELOG.md section for the version in package.json to out/release-notes.md,
// which electron-builder publishes as the GitHub release text. Fails without a section, so no
// release goes out without telling people what's new.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const md = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n')

const heading = /^##\s+\[?v?(\d+\.\d+\.\d+(?:-[\w.]+)?)\]?(?:\s*[-–—]\s*\S.*)?\s*$/
const lines = md.split('\n')
const start = lines.findIndex((l) => heading.exec(l)?.[1] === version)
if (start === -1) {
  console.error(
    `✗ CHANGELOG.md hat keinen Abschnitt „## ${version}“. Bitte zuerst eintragen, was neu ist.`
  )
  process.exit(1)
}
let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l))
if (end === -1) end = lines.length
const body = lines
  .slice(start + 1, end)
  .join('\n')
  .trim()
if (!body) {
  console.error(`✗ Der Abschnitt „## ${version}“ in CHANGELOG.md ist leer.`)
  process.exit(1)
}
mkdirSync(path.join(root, 'out'), { recursive: true })
writeFileSync(path.join(root, 'out', 'release-notes.md'), body + '\n')
console.log(`✓ Release Notes für ${version} (${body.split('\n').length} Zeilen)`)
