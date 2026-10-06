const pad = (n: number): string => String(n).padStart(2, '0')

/** ISO 8601 with local offset, e.g. `2026-10-05T12:40:00+02:00`. */
export function isoLocal(d = new Date()): string {
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const abs = Math.abs(off)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

/** `2026-10-05` */
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** `14:05` */
export function timeKey(d = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
