// Measures time from launch until the page tree is usable: node scripts/measure-startup.mjs <vault> <userdata>
import { _electron as electron } from '@playwright/test'
const [vault, ud] = process.argv.slice(2)
const t0 = Date.now()
const app = await electron.launch({
  args: ['.'],
  env: { ...process.env, WRITE_VAULT: vault, WRITE_USER_DATA: ud, WRITE_NO_UPDATES: '1' }
})
const win = await app.firstWindow()
await win.waitForSelector('.tree-row')
const tree = Date.now() - t0
// Open the first page (expanding its folder if needed)
const firstPage = win.locator('.tree-row:has(.icon svg path[d^="M4.25"]) .name').first()
if (!(await firstPage.isVisible().catch(() => false)))
  await win.locator('.tree-row .name').first().click()
await firstPage.click()
await win.waitForSelector('.bn-editor')
const page = Date.now() - t0
await win.waitForFunction(() => !document.querySelector('.index-progress progress'), null, {
  timeout: 120000
})
const indexed = Date.now() - t0
const s = Date.now()
await win.locator('.sidebar-item', { hasText: 'Suchen' }).click()
await win.locator('.search-field input').fill('architektur')
await win.waitForSelector('.result')
console.log(
  JSON.stringify({
    treeVisibleMs: tree,
    firstPageMs: page,
    indexDoneMs: indexed,
    searchRoundTripMs: Date.now() - s,
    resultInfo: await win.locator('.result-count').textContent()
  })
)
await app.close()
