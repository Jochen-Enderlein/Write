/** Reads a `WRITE_*` environment variable; the old `DOCU_*` names still work. */
export function env(name: string): string | undefined {
  return process.env[`WRITE_${name}`] ?? process.env[`DOCU_${name}`]
}
