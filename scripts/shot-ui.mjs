// Dev helper: screenshots palette, history sheet and quick capture.
import { _electron as electron } from '@playwright/test'
const SP = process.env.SP
const app = await electron.launch({
  args: ['.'],
  env: {
    ...process.env,
    WRITE_VAULT: SP + '/vault',
    WRITE_USER_DATA: SP + '/userdata',
    WRITE_NO_UPDATES: '1'
  }
})
const win = await app.firstWindow()
const logs = []
win.on('pageerror', (e) => logs.push(e.message))
await win.waitForSelector('.tree-row')
await win.locator('.tree-row .name', { hasText: 'Docu-App' }).click()
await win.waitForSelector('.bn-editor')
// edit to create history
await win.locator('.bn-editor p').first().click()
await win.keyboard.press('End')
await win.keyboard.type(' Neu ergänzt.')
await win.waitForTimeout(5500)
await win.keyboard.type(' Noch mehr.')
await win.waitForTimeout(800)
await win.locator('.toolbar .icon-button[title^="Seitenhistorie"]').click()
await win.waitForTimeout(900)
await win.screenshot({ path: SP + '/ui-history.png' })
await win.keyboard.press('Escape')
await win.waitForTimeout(300)
await app.evaluate(({ BrowserWindow }) =>
  BrowserWindow.getAllWindows()
    .find((w) => !w.webContents.getURL().includes('capture'))
    .webContents.send('menu:command', 'palette.open')
)
await win.waitForTimeout(300)
await win.keyboard.type('doc')
await win.waitForTimeout(400)
await win.screenshot({ path: SP + '/ui-palette.png' })
await win.keyboard.press('Escape')
const capture = app.windows().find((w) => w.url().includes('capture'))
if (capture) {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().includes('capture'))
      .show()
  )
  await capture.locator('textarea').fill('Idee aus Quick Capture #inbox')
  await capture.screenshot({ path: SP + '/ui-capture.png' })
  await capture.locator('textarea').press('Enter')
  await win.waitForTimeout(1000)
}
console.log(logs.join('\n') || 'keine Fehler')
await app.close()
