import type { IpcArgs, IpcChannel, IpcEvent, IpcEvents, IpcResults } from '@shared/ipc'
import { t } from './i18n'

export function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcArgs<C>
): Promise<IpcResults[C]> {
  return window.write.invoke(channel, ...args)
}

export function on<E extends IpcEvent>(
  event: E,
  listener: (...args: IpcEvents[E]) => void
): () => void {
  return window.write.on(event, listener)
}

/** Turns an IPC error into a readable German message. */
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const msg = raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
  if (/^error\.\w+$/.test(msg)) return t(msg)
  return t('error.generic', { message: msg })
}
