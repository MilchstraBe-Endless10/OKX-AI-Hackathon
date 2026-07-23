import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @sopscape/server start',
      url: 'http://127.0.0.1:3000/health/live',
      timeout: 30000,
      reuseExistingServer: true,
      env: {
        PORT: '3000',
        SOPSCAPE_REQUIRE_AUTH: 'true',
        SOPSCAPE_OWNER_PASSWORD: 'SOPscape-Demo-2026',
        SOPSCAPE_SESSION_SECRET: 'e2e-session-secret',
      },
    },
    {
      command: 'pnpm --filter @sopscape/web build && pnpm --filter @sopscape/web preview',
      url: 'http://127.0.0.1:4173',
      timeout: 60000,
      reuseExistingServer: true,
    },
  ],
});
