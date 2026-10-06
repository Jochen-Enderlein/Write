// Dev helper: launches the built app against a vault and screenshots a list of pages.
import { _electron as electron } from '@playwright/test'
const SP = process.env.SP
const app = await electron.launch({
  args: ['.'],
  env: {
    ...process.env,
    WRITE_VAULT: process.env.VAULT ?? SP + '/vault',
    WRITE_USER_DATA: SP + '/userdata'
  }
})
const logs = []
const win = await app.firstWindow()
win.on('console', (m) => m.type() !== 'warning' && logs.push(`[${m.type()}] ${m.text()}`))
win.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await win.waitForTimeout(2000)
let i = 0
try {
  for (const target of (process.env.OPEN ?? '').split(',').filter(Boolean)) {
    await win.locator('.tree-row .name', { hasText: target }).first().click()
    await win.waitForTimeout(1800)
    await win.screenshot({ path: `${SP}/page-${++i}.png` })
  }
} finally {
  console.log(logs.join('\n'))
  await app.close()
}
