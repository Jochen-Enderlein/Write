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

  // One draft, created before electron-builder starts: its parallel uploads (DMG, ZIP) then
  // all find it instead of racing to create releases of their own
  if (!release) {
    await api('POST', '/releases', {
      tag_name: tag,
      name: version,
      body: readFileSync(path.join(root, 'out', 'release-notes.md'), 'utf8'),
      draft: true
    })
    console.log(`✓ Entwurf für ${tag} angelegt`)
  }
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
  return res.status === 204 ? null : res.json()
}

async function publish() {
  if (!process.env.GH_TOKEN) fail('GH_TOKEN ist nicht gesetzt.')
  const all = (await api('GET', '/releases?per_page=50')).filter((r) => r.tag_name === tag)
  if (!all.length) fail(`Kein Release ${tag} auf GitHub gefunden.`)
  if (all.some((r) => !r.draft) && all.length > 1)
    fail(
      `Zu ${tag} gibt es ein veröffentlichtes Release und weitere Entwürfe. Bitte auf GitHub prüfen.`
    )

  // Parallel uploads may have spread the files over several drafts: keep the fullest one
  const has = (r, n) => r.assets.some((a) => a.name === n && a.state === 'uploaded')
  const score = (r) => neededAssets().filter((n) => has(r, n)).length
  const [release, ...duplicates] = [...all].sort((a, b) => score(b) - score(a))

  // Whatever is missing comes straight from this build's dist/
  const dist = path.join(root, 'dist')
  const wanted = [
    ...neededAssets(),
    ...neededAssets()
      .slice(0, 2)
      .map((n) => `${n}.blockmap`)
  ]
  for (const name of wanted) {
    if (has(release, name)) continue
    const file = path.join(dist, name)
    let data
    try {
      data = readFileSync(file)
    } catch {
      if (neededAssets().includes(name))
        fail(`${name} fehlt im Release und in dist/. Bitte neu bauen.`)
      continue
    }
    const broken = release.assets.find((a) => a.name === name)
    if (broken) await api('DELETE', `/releases/assets/${broken.id}`)
    const res = await fetch(
      `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/octet-stream'
        },
        body: data
      }
    )
    if (!res.ok) fail(`Hochladen von ${name}: ${res.status} ${await res.text()}`)
    console.log(`✓ ${name} nachgeladen`)
  }
  for (const d of duplicates) {
    await api('DELETE', `/releases/${d.id}`)
    console.log(`✓ Doppelten Entwurf entfernt`)
  }

  const final = await api('GET', `/releases/${release.id}`)
  const missing = neededAssets().filter((n) => !has(final, n))
  if (missing.length) fail(`Im Release fehlen: ${missing.join(', ')}. Nicht veröffentlicht.`)
  if (final.draft)
    await api('PATCH', `/releases/${release.id}`, { draft: false, make_latest: 'true' })
  console.log(`✓ ${tag} veröffentlicht: https://github.com/${repo}/releases/tag/${tag}`)
  console.log(`  Dateien: ${final.assets.map((a) => a.name).join(', ')}`)
}

const step = process.argv[2]
if (step === 'prepare') await prepare()
else if (step === 'publish') await publish()
else if (step === 'notes') releaseNotes()
else fail('Aufruf: node scripts/release.mjs prepare|publish|notes')
