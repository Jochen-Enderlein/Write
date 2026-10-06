import { _electron as electron } from '@playwright/test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
const root = mkdtempSync(path.join(tmpdir(), 'write-shot-'))
const vault = path.join(root, 'Vault'); mkdirSync(vault)
writeFileSync(path.join(vault, 'Notiz.md'), '# Notiz\n\nText.\n')
mkdirSync(path.join(root, 'userdata'))
writeFileSync(path.join(root, 'userdata', 'settings.json'), JSON.stringify({ settings: { language: 'de' } }))
const app = await electron.launch({ args: ['.'], env: { ...process.env, WRITE_VAULT: vault, WRITE_USER_DATA: path.join(root, 'userdata'), WRITE_NO_UPDATES: '1' } })
let win = app.windows().find(w => !w.url().includes('capture'))
while (!win) { const w = await app.waitForEvent('window'); if (!w.url().includes('capture')) win = w }
await win.setViewportSize({ width: 1100, height: 700 })
await win.waitForSelector('.tree-row')
const send = (ch, arg) => app.evaluate(({ BrowserWindow }, [c, a]) => BrowserWindow.getAllWindows().find(w => !w.webContents.getURL().includes('capture')).webContents.send(c, a), [ch, arg])
await send('update:status', { state: 'ready', version: '0.2.0' })
await win.waitForTimeout(600)
await win.screenshot({ path: '/private/tmp/claude-501/-Users-jochenenderlein-dev-Write/b4380a9a-b90e-4a7e-8a7a-acac92f6f8c1/scratchpad/update-ready.png' })
await send('menu:command', 'help.whatsNew')
await win.waitForTimeout(600)
await win.screenshot({ path: '/private/tmp/claude-501/-Users-jochenenderlein-dev-Write/b4380a9a-b90e-4a7e-8a7a-acac92f6f8c1/scratchpad/whats-new.png' })
await app.close()
