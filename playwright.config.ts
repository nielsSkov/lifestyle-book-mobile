import { defineConfig, devices } from '@playwright/test'

const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? '/'
const serverUrl = `http://127.0.0.1:4173${basePath}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: serverUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command:
      basePath === '/' ? 'npm run preview -- --host 127.0.0.1' : 'node scripts/pages-server.mjs',
    url: serverUrl,
    reuseExistingServer: false,
  },
})
