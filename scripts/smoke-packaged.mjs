// Launches the packaged app against a vault and checks that index + editor work.
// node scripts/smoke-packaged.mjs <executable> <vault> <userdata> [screenshot.png]
import { _electron as electron } from '@playwright/test'
const [exe, vault, ud, shot] = process.argv.slice(2)

/** The app opens the main window and a hidden Quick Capture panel; pick the main one. */
async function mainWindow(app) {
  const isMain = (w) => !w.url().includes('capture')
  const found = app.windows().find(isMain)
  if (found) return found
  for (;;) {
    const w = await app.waitForEvent('window')
    if (isMain(w)) return w
  }
}
const app = await electron.launch({ executablePath: exe, env: { ...process.env, WRITE_VAULT: vault, WRITE_USER_DATA: ud, WRITE_NO_UPDATES: '1' } })
const logs = []
app.process().stdout?.on('data', (d) => logs.push('[main] ' + d))
app.process().stderr?.on('data', (d) => logs.push('[main] ' + d))
const win = await mainWindow(app)
win.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
win.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
try {
  await win.waitForSelector('.tree-row', { timeout: 20000 })
  await win.locator('.sidebar-item', { hasText: 'Suchen' }).click()
  await win.locator('.search-field input').fill('Wahrheit')
  await win.waitForSelector('.result', { timeout: 10000 })
  console.log('OK – Treffer:', await win.locator('.result-count').textContent())
} catch (err) {
  console.log('FEHLER:', err.message.split('\n')[0])
  if (shot) await win.screenshot({ path: shot })
  console.log(logs.filter((l) => !l.includes('viewport meta')).join('\n').slice(0, 3000))
  process.exitCode = 1
} finally {
  await app.close()
}
