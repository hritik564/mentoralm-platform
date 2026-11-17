import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'admin-ui.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  forbidOnly: true,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    baseURL: 'http://127.0.0.1:3191',
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'off',
    reducedMotion: 'reduce',
  },
});
