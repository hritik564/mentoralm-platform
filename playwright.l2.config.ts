import { defineConfig } from '@playwright/test';
import base from './playwright.d4.config';
process.env.L2_TEST_MEDIA = '1';
export default defineConfig({
  ...base,
  testMatch: 'lms-l2.spec.ts',
  projects: [
    {
      name: 'l2-desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'l2-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
