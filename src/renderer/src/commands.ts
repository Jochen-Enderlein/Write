import { dayKey } from '@shared/dates'
import type { CommandId } from '@shared/keymap'
import { invoke } from './api'
import { t } from './i18n'
import { adjacentDay, journalDayOf, journalDays } from './lib/journal'
import { toggleTheme } from './lib/theme'
import { checkForUpdates } from './lib/updates'
import { titleOf, useStore } from './store'

async function exportPage(format: 'pdf' | 'html' | 'print', path: string): Promise<void> {
  const s = useStore.getState()
  const editor = s.editor
  if (!editor || editor.path !== path) return
  await editor.flush()
  const target = await invoke('page:export', {
    format,
    title: titleOf(path),
    html: editor.exportHtml()
  })
  if (target) s.notify(t('export.done', { path: target.replace(/^.*\//, '') }))
}

/** Runs a command from the menu bar, a shortcut or the command palette. */
export async function runCommand(id: CommandId): Promise<void> {
  const s = useStore.getState()
  const page = s.view.kind === 'page' ? s.view.path : null
  try {
    switch (id) {
      case 'page.new':
        return await s.newPage('')
      case 'shortcuts.show':
        return s.setSheet(s.sheet?.kind === 'shortcuts' ? null : { kind: 'shortcuts' })
      case 'settings.open':
        return s.setSheet({ kind: 'settings' })
      case 'folder.new':
        return await s.newFolder('')
      case 'page.open':
        return s.setPalette(true, 'pages')
      case 'palette.open':
        return s.setPalette(!s.palette.open, 'all')
      case 'search.fulltext':
        return s.navigate({ kind: 'search', query: '', tag: null })
      case 'sidebar.toggle':
        return s.toggleSidebar()
      case 'journal.today':
        return await s.openJournal()
      case 'page.rename':
        if (page) s.requestTitleFocus()
        return
      case 'page.trash':
        if (page) await s.trashPage(page)
        return
      case 'page.favorite':
        if (page) await s.toggleFavorite(page)
        return
      case 'page.history':
        if (page) s.setSheet({ kind: 'history', path: page })
        return
      case 'page.info':
        if (page) s.setInfoOpen(!s.infoOpen)
        return
      case 'page.reveal':
        if (page) await invoke('page:reveal', page)
        return
      case 'page.move':
        if (page) s.setPalette(true, 'move')
        return
      case 'template.insert':
        return s.setPalette(true, 'templates')
      case 'vault.switch':
        return s.setPalette(true, 'vaults')
      case 'vault.open':
        return await s.setVault(await invoke('vault:openDialog'))
      case 'vault.create':
        return await s.setVault(await invoke('vault:create'))
      case 'trash.show':
        return s.navigate({ kind: 'trash' })
      case 'tags.show':
        return s.navigate({ kind: 'tags' })
      case 'view.modeRich':
        return s.setEditorMode('rich')
      case 'view.modeMarkdown':
        return s.setEditorMode('markdown')
      case 'view.modeSplit':
        return s.setEditorMode('split')
      case 'graph.show':
        return s.navigate({ kind: 'graph', center: null })
      case 'page.graph':
        if (page) s.navigate({ kind: 'graph', center: page })
        return
      case 'conflicts.show':
        return s.setSheet({ kind: 'conflicts' })
      case 'index.rebuild':
        await invoke('index:rebuild')
        return s.notify(t('cmd.rebuildIndex') + ' …')
      case 'nav.back':
        return s.goBack()
      case 'nav.forward':
        return s.goForward()
      case 'capture.open':
        return
      case 'find.open':
        if (page) s.openFind(false)
        return
      case 'find.replace':
        if (page) s.openFind(true)
        return
      case 'find.next':
        if (page) s.stepFind(1)
        return
      case 'find.previous':
        if (page) s.stepFind(-1)
        return
      case 'page.outline':
        return s.toggleOutline()
      case 'view.focus':
        return s.toggleFocusMode()
      case 'view.theme':
        return await toggleTheme()
      case 'update.check':
        return await checkForUpdates()
      case 'help.whatsNew':
        return s.setSheet({ kind: 'whatsNew', since: null })
      case 'page.icon':
        if (page) useStore.setState({ iconPickerToken: s.iconPickerToken + 1 })
        return
      case 'page.newWindow':
        if (page) await s.openInNewWindow(page)
        return
      case 'page.exportPdf':
        if (page) await exportPage('pdf', page)
        return
      case 'page.exportHtml':
        if (page) await exportPage('html', page)
        return
      case 'page.print':
        if (page) await exportPage('print', page)
        return
      case 'journal.previous':
      case 'journal.next': {
        const days = journalDays(s.titles)
        const from = (page && journalDayOf(page)) ?? dayKey()
        const day = adjacentDay(days, from, id === 'journal.next' ? 1 : -1)
        if (day) await s.openJournalDay(day)
        return
      }
      case 'journal.calendar':
        if (!page || !journalDayOf(page)) await s.openJournal()
        useStore.setState({ calendarOpen: true })
        return
    }
  } catch (err) {
    s.fail(err)
  }
}
