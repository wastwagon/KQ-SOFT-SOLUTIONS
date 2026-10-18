import { defineConfig, devices } from '@playwright/test'

/**
 * Public-surface smoke tests. Starts Vite preview after build, or reuse
 * PLAYWRIGHT_BASE_URL when pointed at a running app.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:49173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 49173',
        url: 'http://127.0.0.1:49173',
        // Always start this app's preview — avoid picking up another Vite preview on 4173.
        reuseExistingServer: false,
        timeout: 180_000,
      },
})
