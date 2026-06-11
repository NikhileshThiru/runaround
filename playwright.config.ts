import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: externalBaseUrl ? undefined : {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
