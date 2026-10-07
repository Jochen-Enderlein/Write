import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  workers: 1,
  // CI runners are slower and sometimes stall; one retry tells flakes from real failures
  retries: process.env.CI ? 1 : 0,
  reporter: 'list'
})
