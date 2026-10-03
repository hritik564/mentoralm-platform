import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { testDatabaseUrl } from './tests/helpers/d4-database';
if (!testDatabaseUrl())
  throw Error('A3 requires the isolated local Test database');
process.env.A3_TEST_SCHEMA ||= `d4_${randomBytes(12).toString('hex')}`;
export default defineConfig({
  testDir: './tests',
  testMatch: ['admin-a3.spec.ts', 'clerk-session.spec.ts'],
  globalTeardown: './tests/helpers/admin-a3-teardown.ts',
  workers: 1,
  retries: 0,
  timeout: 300000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3103',
    channel: 'chromium',
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'off',
    screenshot: 'off',
  },
  webServer: {
    command:
      'NODE_OPTIONS=--conditions=react-server npx tsx tests/helpers/admin-a3-server.ts',
    url: 'http://127.0.0.1:3103',
    reuseExistingServer: false,
    timeout: 90000,
  },
});
