import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { WriteApi } from '../shared/ipc'

/** The only bridge between renderer and main: typed invoke + event subscription, nothing else. */
const api: WriteApi = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (event, listener) => {
    const wrapped = (_e: IpcRendererEvent, ...args: unknown[]): void =>
      (listener as (...a: unknown[]) => void)(...args)
    ipcRenderer.on(event, wrapped)
    return () => ipcRenderer.removeListener(event, wrapped)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('write', api)
