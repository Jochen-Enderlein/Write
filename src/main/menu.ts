import { Menu, app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import type { i18n } from 'i18next'
import { COMMANDS, type CommandDef, type CommandId } from '@shared/keymap'

/** Builds the menu bar from the central keymap; every item forwards its command to the renderer. */
export function buildMenu(
  t: i18n['t'],
  getWindow: () => BrowserWindow | null,
  onCommand: (id: CommandId) => boolean
): void {
  const item = (c: CommandDef): MenuItemConstructorOptions => ({
    label: t(c.label),
    accelerator: c.accelerator,
    click: () => {
      if (onCommand(c.id)) return
      const win = getWindow()
      win?.show()
      win?.webContents.send('menu:command', c.id)
    }
  })
  const of = (menu: CommandDef['menu']): MenuItemConstructorOptions[] =>
    COMMANDS.filter((c) => c.menu === menu).map(item)

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: t('menu.about', { name: app.name }) },
        { type: 'separator' },
        ...of('app'),
        { type: 'separator' },
        { role: 'services', label: t('menu.services') },
        { type: 'separator' },
        { role: 'hide', label: t('menu.hide', { name: app.name }) },
        { role: 'hideOthers', label: t('menu.hideOthers') },
        { role: 'unhide', label: t('menu.unhide') },
        { type: 'separator' },
        { role: 'quit', label: t('menu.quit', { name: app.name }) }
      ]
    },
    {
      label: t('menu.file'),
      submenu: [...of('file'), { type: 'separator' }, { role: 'close', label: t('menu.close') }]
    },
    {
      label: t('menu.edit'),
      submenu: [
        { role: 'undo', label: t('menu.undo') },
        { role: 'redo', label: t('menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: t('menu.cut') },
        { role: 'copy', label: t('menu.copy') },
        { role: 'paste', label: t('menu.paste') },
        { role: 'pasteAndMatchStyle', label: t('menu.pastePlain') },
        { role: 'selectAll', label: t('menu.selectAll') },
        { type: 'separator' },
        ...of('edit')
      ]
    },
    { label: t('menu.page'), submenu: of('page') },
    { label: t('menu.go'), submenu: of('go') },
    {
      label: t('menu.view'),
      submenu: [
        ...of('view'),
        { type: 'separator' },
        { role: 'resetZoom', label: t('menu.resetZoom') },
        { role: 'zoomIn', label: t('menu.zoomIn') },
        { role: 'zoomOut', label: t('menu.zoomOut') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('menu.fullscreen') },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }])
      ]
    },
    { role: 'windowMenu', label: t('menu.window') },
    { role: 'help', label: t('menu.help'), submenu: of('help') }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
