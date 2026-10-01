import { defineConfig } from '@playwright/test';
import base from './playwright.d4.config';
export default defineConfig({
  ...base,
  testMatch: 'lms-l1.spec.ts',
  projects: [
    {
      name: 'l1-desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'l1-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
