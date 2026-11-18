import { defineConfig } from '@playwright/test';

const preservedPublicTests = {
  testMatch: ['home.spec.ts', 'journey.spec.ts'],
  // The removed homepage Ecosystem and earlier cinematic Hero remain covered
  // only by their historical tests; these cases exercise the current page.
  grep: /seven public module positions and strict origin configuration|homepage is rendered with public SEO content before JavaScript|responsive navigation works with keyboard, escape, and anchor selection|six readable milestones follow the approved order in a light responsive journey|milestone keyboard and tap emphasis is accessible and does not create a new journey|the whole roadmap remains readable without JavaScript|active milestones illuminate the cumulative route while preserving quiet later stages|cool opening and warm destination remain distinct with tighter readable surfaces|planned opportunities disclose scope and narrow screens remain usable/,
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  forbidOnly: true,
  reporter: 'list',
  outputDir: 'test-results/homepage-redesign',
  use: {
    baseURL: 'http://127.0.0.1:3111',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 3111',
    url: 'http://127.0.0.1:3111',
    reuseExistingServer: false,
    timeout: 120_000,
    // Public presentation validation does not need a Clerk provider or session.
    // Explicit process values take precedence over local environment files.
    env: {
      MENTORALM_ENV: 'local',
      DATABASE_URL: '',
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3111',
      NEXT_PUBLIC_LMS_ORIGIN: '',
      NEXT_PUBLIC_ADMIN_ORIGIN: '',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: '',
    },
  },
  projects: [
    {
      name: 'homepage',
      testMatch: 'homepage-redesign.spec.ts',
    },
    {
      name: 'restored-navbar-desktop',
      testMatch: 'navigation.spec.ts',
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'restored-navbar-mobile',
      testMatch: 'navigation.spec.ts',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'unchanged-public-sections',
      ...preservedPublicTests,
    },
    {
      name: 'unchanged-public-mobile',
      ...preservedPublicTests,
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
