import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { testDatabaseUrl } from './tests/helpers/d4-database';
testDatabaseUrl(); // Refuse unsafe test configuration before starting a server.
process.env.D4_TEST_SCHEMA ||= `d4_${randomBytes(12).toString('hex')}`;
export default defineConfig({
  testDir: './tests',
  testMatch: 'dashboard-d4.spec.ts',
  globalTeardown: './tests/helpers/d4-teardown.ts',
  workers: 1,
  retries: 0,
  timeout: 120000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'off', screenshot: 'off' },
  webServer: {
    command: 'npx tsx tests/helpers/d4-server.ts',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 90000,
  },
  projects: [
    {
      name: 'd4-desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'd4-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
