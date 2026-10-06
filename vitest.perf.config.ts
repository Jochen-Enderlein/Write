import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared'), '@renderer': resolve('src/renderer/src') } },
  test: { include: ['tests/perf/**/*.test.ts'], environment: 'node', testTimeout: 300_000, hookTimeout: 300_000 }
})
