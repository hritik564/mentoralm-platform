import { defineConfig } from '@playwright/test';
import base from './playwright.d4.config';
export default defineConfig({
  ...base,
  webServer: {
    ...base.webServer!,
    command:
      'NODE_OPTIONS=--conditions=react-server npx tsx tests/helpers/admin-regression-server.ts',
  },
  testDir: './tests',
  projects: [{ name: 'admin-regression', use: { browserName: 'chromium' } }],
  testMatch: 'admin-a1.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 240000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    channel: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'off',
  },
});
