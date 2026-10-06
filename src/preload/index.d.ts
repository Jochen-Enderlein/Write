import type { WriteApi } from '../shared/ipc'

declare global {
  interface Window {
    write: WriteApi
  }
}
export {}
