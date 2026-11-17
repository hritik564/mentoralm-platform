import { defineConfig } from '@playwright/test';

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
      testMatch: ['home.spec.ts', 'modules.spec.ts', 'journey.spec.ts'],
      // These existing tests cover preserved public content without depending
      // on the superseded cinematic Hero.
      grep: /seven public module positions and strict origin configuration|homepage is rendered with public SEO content before JavaScript|Coming Soon stays unavailable and other undelivered pathways retain honest dialogs and no-JavaScript content|pause and reduced motion stop Menti movement while preserving focus highlights and accessibility|six readable milestones follow the approved order in a light responsive journey|milestone keyboard and tap emphasis is accessible and does not create a new journey|the whole roadmap remains readable without JavaScript|active milestones illuminate the cumulative route while preserving quiet later stages|cool opening and warm destination remain distinct with tighter readable surfaces|planned opportunities disclose scope and narrow screens remain usable/,
    },
  ],
});
