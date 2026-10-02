import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'admin-a2.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 240000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel: 'chromium',
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'off',
    screenshot: 'off',
  },
});
