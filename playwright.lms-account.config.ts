import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'lms-account.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 180000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'off',
  },
});
