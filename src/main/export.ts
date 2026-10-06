import { BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ulid } from 'ulid'
import { sanitizeTitle } from '@shared/paths'

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp'
}

export interface ExportRequest {
  format: 'pdf' | 'html' | 'print'
  title: string
  html: string
}

export interface ExportLabels {
  pdfTitle: string
  htmlTitle: string
}

/**
 * Exports a page the renderer already rendered to self-contained HTML: as an HTML file, as PDF
 * or to the printer. Images from the vault are inlined, so the result works outside the app.
 * Returns the written file, or null when the user cancelled (or for printing).
 */
export async function exportPage(
  req: ExportRequest,
  parent: BrowserWindow | null,
  absOf: (rel: string) => string,
  labels: ExportLabels
): Promise<string | null> {
  const html = await inlineAssets(req.html, absOf)
  const name = sanitizeTitle(req.title)

  if (req.format === 'html') {
    const target = await askTarget(parent, labels.htmlTitle, `${name}.html`, 'HTML', ['html'])
    if (!target) return null
    await fs.writeFile(target, html)
    return target
  }

  // PDF and print render the page in a hidden window, always in light appearance
  const tmp = path.join(os.tmpdir(), `write-export-${ulid()}.html`)
  await fs.writeFile(tmp, html)
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { sandbox: true, contextIsolation: true, javascript: false }
  })
  try {
    await win.loadFile(tmp)
    try {
      win.webContents.debugger.attach()
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: 'light' }]
      })
    } catch {
      // Emulation is cosmetic; the export CSS already prefers light colors
    }
    if (req.format === 'print') {
      await new Promise<void>((resolve) =>
        win.webContents.print({ printBackground: true }, () => resolve())
      )
      return null
    }
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 },
      displayHeaderFooter: false
    })
    const target = await askTarget(parent, labels.pdfTitle, `${name}.pdf`, 'PDF', ['pdf'])
    if (!target) return null
    await fs.writeFile(target, pdf)
    return target
  } finally {
    win.destroy()
    void fs.rm(tmp, { force: true })
  }
}

async function askTarget(
  parent: BrowserWindow | null,
  title: string,
  fileName: string,
  kind: string,
  extensions: string[]
): Promise<string | null> {
  const opts = {
    title,
    defaultPath: path.join(os.homedir(), 'Desktop', fileName),
    filters: [{ name: kind, extensions }]
  }
  const res = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts)
  return res.canceled || !res.filePath ? null : res.filePath
}

/** Replaces `vault-asset://vault/…` URLs with data URIs. Missing files keep their URL. */
async function inlineAssets(html: string, absOf: (rel: string) => string): Promise<string> {
  const re = /vault-asset:\/\/vault\/([^"'()\s<>]+)/g
  const urls = [...new Set([...html.matchAll(re)].map((m) => m[0]))]
  const data = new Map<string, string>()
  await Promise.all(
    urls.map(async (url) => {
      try {
        const rel = url
          .slice('vault-asset://vault/'.length)
          .split('/')
          .map(decodeURIComponent)
          .join('/')
        const ext = path.extname(rel).slice(1).toLowerCase()
        const bytes = await fs.readFile(absOf(rel))
        data.set(
          url,
          `data:${MIME[ext] ?? 'application/octet-stream'};base64,${bytes.toString('base64')}`
        )
      } catch {
        // leave the URL as is
      }
    })
  )
  return html.replace(re, (url) => data.get(url) ?? url)
}
