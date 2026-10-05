import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    {
      command: '../backend/.venv/bin/python e2e/start-backend.py',
      url: 'http://127.0.0.1:8001/api/projects/',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3001',
      url: 'http://127.0.0.1:3001/login',
      env: { API_URL: 'http://127.0.0.1:8001/api', SSO_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
