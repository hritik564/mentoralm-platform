import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { testDatabaseUrl } from './tests/helpers/d4-database';

if (!testDatabaseUrl()) throw Error('Isolated local Test database required.');
if (
  !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') ||
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_')
)
  throw Error('Clerk Development required.');
process.env.D4_TEST_SCHEMA ||= `d4_${randomBytes(12).toString('hex')}`;
process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3113';

export default defineConfig({
  testDir: './tests',
  testMatch: 'marketplace-m4.spec.ts',
  globalTeardown: './tests/helpers/d4-teardown.ts',
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  forbidOnly: true,
  reporter: 'list',
  outputDir: 'test-results/marketplace-m4',
  use: {
    baseURL: 'http://127.0.0.1:3113',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  },
  webServer: {
    command:
      'NODE_OPTIONS=--conditions=react-server npx tsx tests/helpers/marketplace-server.ts',
    url: 'http://127.0.0.1:3113',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
