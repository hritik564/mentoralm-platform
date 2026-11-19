import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'legal-pages.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120000,
  reporter: 'list',
  outputDir: 'test-results/legal',
  use: {
    baseURL: 'http://127.0.0.1:3114',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'node tests/helpers/legal-server.mjs',
    url: 'http://127.0.0.1:3114/terms',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
