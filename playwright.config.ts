import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  workers: 1,
  // CI runners are slower and sometimes stall; one retry tells flakes from real failures
  retries: process.env.CI ? 1 : 0,
  // On CI, opening a page can take longer than the default 5 seconds
  expect: { timeout: process.env.CI ? 15000 : 5000 },
  reporter: 'list'
})
