// Release in two steps around electron-builder, so a release only becomes visible once it is
// complete – an installed app must never find a release without its update files.
//
//   node scripts/release.mjs prepare   checks, release notes, git tag, clean dist/
//   (electron-builder uploads into a *draft* release)
//   node scripts/release.mjs publish   verifies the draft's files, then publishes it
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const tag = `v${version}`
const repo = 'Jochen-Enderlein/Write'
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function releaseNotes() {
  const md = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n')
  const heading = /^##\s+\[?v?(\d+\.\d+\.\d+(?:-[\w.]+)?)\]?(?:\s*[-–—]\s*\S.*)?\s*$/
  const lines = md.split('\n')
  const start = lines.findIndex((l) => heading.exec(l)?.[1] === version)
  if (start === -1)
    fail(`CHANGELOG.md hat keinen Abschnitt „## ${version}“. Bitte zuerst eintragen, was neu ist.`)
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l))
  if (end === -1) end = lines.length
  const body = lines
    .slice(start + 1, end)
    .join('\n')
    .trim()
  if (!body) fail(`Der Abschnitt „## ${version}“ in CHANGELOG.md ist leer.`)
  mkdirSync(path.join(root, 'out'), { recursive: true })
  writeFileSync(path.join(root, 'out', 'release-notes.md'), body + '\n')
  console.log(`✓ Release Notes für ${version}`)
}

async function prepare() {
  if (!process.env.GH_TOKEN) fail('GH_TOKEN ist nicht gesetzt (siehe README → Release-Build).')
  releaseNotes()
  // The tag is the source code of this release (GPL): it must be exactly what is on GitHub
  if (git('status', '--porcelain'))
    fail('Es gibt nicht committete Änderungen. Erst committen und pushen.')
  git('fetch', '--quiet', 'origin', 'main', '--tags', '--force')
  const head = git('rev-parse', 'HEAD')
  if (head !== git('rev-parse', 'origin/main'))
    fail('main ist nicht auf dem Stand von GitHub. Erst pushen bzw. pullen.')

  const release = (await api('GET', '/releases?per_page=30')).find((r) => r.tag_name === tag)
  const missing = release
    ? neededAssets().filter((n) => !release.assets.some((a) => a.name === n))
    : neededAssets()
  if (release && !release.draft && !missing.length)
    fail(`${tag} ist schon vollständig veröffentlicht. Version in package.json erhöhen.`)

  const tagged = git('tag', '--list', tag) ? git('rev-list', '-n', '1', tag) : null
  if (tagged === head) console.log(`✓ Tag ${tag} zeigt auf den aktuellen Commit`)
  else {
    // Only a version that never went out completely may have its tag moved
    git('tag', '-f', '-a', tag, '-m', `Write ${version}`)
    console.log(
      tagged ? `✓ Tag ${tag} auf den aktuellen Commit verschoben` : `✓ Tag ${tag} angelegt`
    )
  }
  git('push', '--quiet', '--force', 'origin', `refs/tags/${tag}`)

  // A published but incomplete release from an earlier attempt goes back to draft, so nobody
  // sees it half-done while electron-builder fills it
  if (release && !release.draft) {
    await api('PATCH', `/releases/${release.id}`, { draft: true })
    console.log(
      `✓ Unvollständiges Release ${tag} zurück in einen Entwurf (es fehlten: ${missing.join(', ')})`
    )
  }

  // No stale files from an earlier build of the same version may be uploaded
  const dist = path.join(root, 'dist')
  mkdirSync(dist, { recursive: true })
  for (const f of readdirSync(dist, { withFileTypes: true }).filter((e) => e.isFile()))
    if (f.name.includes(version) || f.name.startsWith('latest')) rmSync(path.join(dist, f.name))
  console.log('✓ Bereit zum Bauen')
}

/** What an installed app needs to update itself, and what people download. */
const neededAssets = () => [
  `Write-${version}-arm64.dmg`,
  `Write-${version}-arm64-mac.zip`,
  'latest-mac.yml'
]

async function api(method, url, body) {
  const res = await fetch(`https://api.github.com/repos/${repo}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) fail(`GitHub ${method} ${url}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function publish() {
  if (!process.env.GH_TOKEN) fail('GH_TOKEN ist nicht gesetzt.')
  const releases = await api('GET', '/releases?per_page=30')
  const release = releases.find((r) => r.tag_name === tag)
  if (!release) fail(`Kein Release ${tag} auf GitHub gefunden.`)
  const names = release.assets.map((a) => a.name)
  const missing = neededAssets().filter((n) => !names.includes(n))
  if (missing.length) fail(`Im Release fehlen: ${missing.join(', ')}. Nicht veröffentlicht.`)
  if (release.draft)
    await api('PATCH', `/releases/${release.id}`, { draft: false, make_latest: 'true' })
  console.log(`✓ ${tag} veröffentlicht: ${release.html_url.replace('/untagged-', '/tag/')}`)
  console.log(`  Dateien: ${names.join(', ')}`)
}

const step = process.argv[2]
if (step === 'prepare') await prepare()
else if (step === 'publish') await publish()
else if (step === 'notes') releaseNotes()
else fail('Aufruf: node scripts/release.mjs prepare|publish|notes')
