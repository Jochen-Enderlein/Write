// Renders resources/icon/icon.html to a transparent 1024px PNG: npx electron resources/icon/render.cjs <out.png>
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true }
  })
  await win.loadFile(path.join(__dirname, 'icon.html'))
  await win.webContents.executeJavaScript('new Promise((r) => { const t = () => (window.__ready ? r() : setTimeout(t, 30)); t() })')
  await new Promise((r) => setTimeout(r, 300))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 })
  const png = image.resize({ width: 1024, height: 1024, quality: 'best' }).toPNG()
  fs.writeFileSync(process.argv[process.argv.length - 1], png)
  app.quit()
})
