import { test, expect, type Page } from '@playwright/test';
import {
  clerk,
  clerkSetup,
  setupClerkTestingToken,
} from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/nextjs/server';
import AxeBuilder from '@axe-core/playwright';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import {
  resolveResourceTarget,
  safeResourcePreview,
  type Resource,
} from '../src/lib/dashboard/resources';
import { resolveReferralLink } from '../src/lib/dashboard/referral';
import { parseDashboardTheme } from '../src/lib/dashboard/theme';

const development =
  process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_');
const review = 'docs/reviews/d3';
mkdirSync(review, { recursive: true });
const resource: Resource = {
  id: 'test-resource',
  title: 'Test certificate',
  description: 'Fixture preview, not a student record.',
  category: 'certificates',
  mimeType: 'image/webp',
  fileName: 'certificate.webp',
  sizeBytes: 2048,
  publishedAt: '2026-10-01T00:00:00Z',
  program: 'Test program',
  course: null,
  preview: { kind: 'image', targetId: 'image' },
  access: { scope: 'assigned', downloadTargetId: 'image' },
};
const registry = {
  targets: {
    image: '/images/campus.webp',
    pdf: '/test-resource.pdf',
    document: '/test-document.zip',
  },
  trustedOrigins: [],
};
async function fixture(page: Page, data: unknown, theme = 'light') {
  await page.goto('/');
  await page.setContent('<div id="fixture-root"></div>');
  await page.evaluate(
    ({ data, theme }) => {
      const element = document.getElementById('fixture-root')!;
      element.dataset.fixture = JSON.stringify(data);
      element.dataset.theme = theme;
    },
    { data, theme },
  );
  await page.addStyleTag({
    content: [
      'tokens.css',
      'global.css',
      'dashboard.css',
      'dashboard-theme.css',
      'dashboard-features.css',
    ]
      .map((file) => readFileSync(`src/styles/${file}`, 'utf8'))
      .join('\n'),
  });
  await page.addScriptTag({ path: `${review}/fixture-bundle.js` });
}
async function scan(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .include('.dashboard-shell')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test.beforeAll(async () => {
  execFileSync(process.execPath, ['tests/helpers/build-d3-fixtures.cjs']);
  if (development) await clerkSetup();
});

test('D3 contracts fail closed, empty records and unavailable support persist nothing', async () => {
  expect(resolveResourceTarget('image', registry)).toBe('/images/campus.webp');
  expect(resolveResourceTarget('image')).toBeNull();
  for (const target of [
    'https://evil.test/file.pdf',
    '//evil.test',
    'javascript:alert(1)',
    '/a/../private',
    '/a/%2e%2e/private',
    '/a\\evil',
    '/a?redirect=evil',
    'https://user:pass@files.example.test/a',
    'https://files.example.test.evil.test/a',
    'https://files.example.test/../a',
  ]) {
    expect(
      resolveResourceTarget('unsafe', {
        targets: { unsafe: target },
        trustedOrigins: ['https://files.example.test'],
      }),
    ).toBeNull();
  }
  for (const mimeType of [
    'image/svg+xml',
    'text/html',
    'application/javascript',
    'application/zip',
  ])
    expect(safeResourcePreview({ ...resource, mimeType }, registry)).toBeNull();
  expect(
    resolveReferralLink('unsafe', {
      links: { unsafe: 'https://evil.test/invite/secret' },
      trustedOrigins: ['https://mentoralm.example.test'],
    }),
  ).toBeNull();
  expect(parseDashboardTheme('invalid')).toBe('light');
});

test('D3 routes reject unauthenticated and forged identity', async ({
  request,
}) => {
  for (const path of [
    '/dashboard/resources',
    '/dashboard/support',
    '/dashboard/referral',
    '/dashboard/profile',
  ]) {
    const response = await request.get(`${path}?userId=other`, {
      maxRedirects: 0,
      headers: { cookie: '__session=forged' },
    });
    expect([302, 303, 307, 308]).toContain(response.status());
    expect(
      new URL(response.headers().location, 'http://127.0.0.1:3100').pathname,
    ).toBe('/sign-in');
  }
});

test('fixture library filters, safe image/text/PDF preview, download and dialog keyboard', async ({
  page,
}) => {
  const text: Resource = {
    ...resource,
    id: 'text',
    category: 'notes',
    title: 'Test notes',
    mimeType: 'text/plain',
    fileName: 'notes.txt',
    preview: {
      kind: 'text',
      text: '<script>window.unsafeExecuted=true</script>\nPlain text only.',
    },
    access: { scope: 'available', downloadTargetId: null },
  };
  const pdf: Resource = {
    ...resource,
    id: 'pdf',
    category: 'documents',
    title: 'Test PDF',
    mimeType: 'application/pdf',
    preview: { kind: 'pdf', targetId: 'pdf' },
  };
  const unsupported: Resource = {
    ...resource,
    id: 'zip',
    title: 'Test download only',
    category: 'other',
    mimeType: 'application/zip',
    preview: null,
    access: { scope: 'available', downloadTargetId: 'document' },
  };
  await page.route('**/test-resource.pdf', (route) =>
    route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' }),
  );
  await fixture(page, {
    surface: 'resources',
    resources: [resource, text, pdf, unsupported],
    registry,
  });
  await expect(
    page.getByRole('button', { name: /upload|edit|delete|replace/i }),
  ).toHaveCount(0);
  const preview = page.getByRole('button', {
    name: 'Preview Test certificate',
  });
  await preview.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.d3-preview-image')).toHaveAttribute(
    'src',
    '/images/campus.webp',
  );
  await expect
    .poll(() =>
      page
        .locator('.d3-preview-image')
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await scan(page);
  await page.getByRole('button', { name: 'Close dialog' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page
      .getByRole('dialog')
      .getByRole('link', { name: 'Download', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Close dialog' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(preview).toBeFocused();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download Test certificate' }).click();
  expect((await downloaded).suggestedFilename()).toBe('certificate.webp');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Test certificate' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview Test notes' }).click();
  await expect(page.locator('.d3-preview-text')).toContainText(
    '<script>window.unsafeExecuted=true</script>',
  );
  expect(await page.evaluate(() => 'unsafeExecuted' in window)).toBe(false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Test PDF' }).click();
  await expect(page.getByTitle('PDF preview: Test PDF')).toHaveAttribute(
    'sandbox',
    '',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('searchbox').fill('no-match');
  await expect(
    page.getByRole('heading', { name: 'No matching resources.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(
    page.getByRole('button', { name: 'Preview Test download only' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Download Test download only' }),
  ).toHaveAttribute('href', '/test-document.zip');
  await fixture(
    page,
    {
      surface: 'resources',
      resources: [
        {
          ...resource,
          preview: { kind: 'image', targetId: 'https://evil.test' },
          access: { scope: 'available', downloadTargetId: 'unsafe' },
        },
      ],
      registry: {
        targets: { unsafe: 'javascript:alert(1)' },
        trustedOrigins: [],
      },
    },
    'dark',
  );
  await expect(page.getByRole('button', { name: /^Preview/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Download/ })).toHaveCount(0);
  await scan(page);
});

test('fixture ticket history and replies retain honest development behavior', async ({
  page,
}) => {
  await fixture(
    page,
    {
      surface: 'support',
      tickets: [
        {
          id: 'test-ticket',
          reference: 'TEST-01',
          subject: 'Test open ticket',
          category: 'Technical',
          status: 'open',
          updatedAt: '2026-10-01T00:00:00Z',
          messages: [
            {
              id: 'test-message',
              author: 'staff',
              body: 'Fixture conversation text.',
              createdAt: '2026-10-01T00:00:00Z',
            },
          ],
        },
        {
          id: 'test-closed',
          reference: 'TEST-02',
          subject: 'Test closed ticket',
          category: 'General',
          status: 'closed',
          updatedAt: '2026-10-01T00:00:00Z',
          messages: [],
        },
      ],
    },
    'dark',
  );
  await page.getByRole('button', { name: 'Test open ticket' }).click();
  await expect(page.getByText('Fixture conversation text.')).toBeVisible();
  await page.getByLabel('Reply', { exact: true }).fill('Fixture reply');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Nothing has been sent or saved.',
  );
  await scan(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Test closed ticket' }).click();
  await expect(page.getByLabel('Reply', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('This ticket is closed. Replies are unavailable.'),
  ).toBeVisible();
});

test('fixture referral copy/share and unsupported share fallback', async ({
  page,
}) => {
  await fixture(page, {
    surface: 'referral',
    summary: {
      code: 'TEST-CODE',
      linkTargetId: 'personal',
      history: [
        {
          id: 'test-referral',
          displayName: 'Test invitation',
          status: 'joined',
          date: '2026-10-01T00:00:00Z',
        },
      ],
    },
    registry: {
      links: { personal: 'https://mentoralm.example.test/invite/TestToken' },
      trustedOrigins: ['https://mentoralm.example.test'],
    },
  });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (link: string) => {
          document.documentElement.dataset.copied = link;
        },
      },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async ({ url }: { url: string }) => {
        document.documentElement.dataset.shared = url;
      },
    });
  });
  await page.getByRole('button', { name: 'Copy Link' }).click();
  await expect(page.getByRole('status')).toHaveText('Referral link copied.');
  expect(
    await page.evaluate(() => document.documentElement.dataset.copied),
  ).toBe('https://mentoralm.example.test/invite/TestToken');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  expect(
    await page.evaluate(() => document.documentElement.dataset.shared),
  ).toBe('https://mentoralm.example.test/invite/TestToken');
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    }),
  );
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Link copied instead.');
  await scan(page);
});

test('real provider profile, D3 empty surfaces, accessible composer and scoped persistent themes', async ({
  page,
}, testInfo) => {
  test.skip(!development, 'Requires Clerk development instance.');
  const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const email = `d3-${Date.now()}-${randomBytes(4).toString('hex')}+clerk_test@example.com`;
  const user = await client.users.createUser({
    emailAddress: [email],
    firstName: 'D3 Reviewer',
    lastName: 'Test',
    skipPasswordRequirement: true,
  });
  try {
    await setupClerkTestingToken({ page });
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: email });
    const publicBackground = await page
      .locator('body')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    for (const theme of ['light', 'dark']) {
      await page.goto('/dashboard/resources');
      const toggle = page.getByRole('button', {
        name: 'Dark mode',
        exact: true,
      });
      if (theme === 'dark') {
        await toggle.focus();
        await page.keyboard.press('Enter');
      }
      await expect(toggle).toHaveAttribute(
        'aria-pressed',
        String(theme === 'dark'),
      );
      await expect(page.locator('.dashboard-shell')).toHaveAttribute(
        'data-dashboard-theme',
        theme,
      );
      for (const area of ['resources', 'support', 'referral', 'profile']) {
        await page.goto(`/dashboard/${area}`);
        await expect(page.locator('.dashboard-shell')).toHaveAttribute(
          'data-dashboard-theme',
          theme,
        );
        await scan(page);
        if (testInfo.project.name === 'd3-desktop' && theme === 'light')
          await page.screenshot({
            path: `${review}/1440-${area}.png`,
            fullPage: true,
          });
        if (
          testInfo.project.name === 'd3-mobile' &&
          theme === 'dark' &&
          area === 'resources'
        )
          await page.screenshot({
            path: `${review}/390-resources-dark.png`,
            fullPage: true,
          });
        if (area === 'resources') {
          await expect(
            page.getByRole('heading', { name: 'No resources available yet.' }),
          ).toBeVisible();
          await expect(
            page.getByRole('button', { name: /upload|edit|delete|replace/i }),
          ).toHaveCount(0);
        }
        if (area === 'support') {
          await expect(
            page.getByRole('heading', {
              name: "You don't have any support tickets yet.",
            }),
          ).toBeVisible();
          await page.getByRole('button', { name: 'Create Ticket' }).click();
          await page.getByRole('button', { name: 'Submit ticket' }).click();
          await expect(
            page.getByLabel('Subject', { exact: true }),
          ).toBeFocused();
          await expect(
            page.getByLabel('Subject', { exact: true }),
          ).toHaveAttribute('aria-invalid', 'true');
          await page
            .getByLabel('Subject', { exact: true })
            .fill('Test subject');
          await page.getByLabel('Message', { exact: true }).fill('Test issue');
          await page.getByRole('button', { name: 'Submit ticket' }).click();
          await expect(
            page.getByRole('dialog').getByRole('status'),
          ).toContainText('not been sent or saved');
          await scan(page);
          await page.keyboard.press('Escape');
          await expect(
            page.getByRole('button', { name: 'Create Ticket' }),
          ).toBeFocused();
        }
        if (area === 'referral') {
          await expect(
            page.getByRole('heading', {
              name: 'Your referral space is ready.',
            }),
          ).toBeVisible();
          await expect(page.locator('.dashboard-content')).not.toContainText(
            /₹|commission|earnings|cash balance|\d+%/,
          );
        }
        if (area === 'profile') {
          await expect(
            page.getByText('D3 Reviewer', { exact: true }),
          ).toBeVisible();
          await expect(
            page
              .locator('.d3-profile-fields')
              .getByText(email, { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole('heading', { name: 'Preferences', exact: true }),
          ).toBeVisible();
          if (testInfo.project.name === 'd3-mobile') {
            await page
              .getByRole('button', { name: 'Open dashboard navigation' })
              .click();
            await expect(
              page
                .getByRole('dialog')
                .locator('.dashboard-nav')
                .getByRole('link'),
            ).toHaveCount(6);
            await expect(
              page.getByRole('dialog').getByRole('link', { name: 'Settings' }),
            ).toHaveCount(0);
            await page.keyboard.press('Escape');
            await expect(
              page.getByRole('button', { name: 'Open dashboard navigation' }),
            ).toBeFocused();
          } else {
            await expect(
              page.locator('.dashboard-nav').first().getByRole('link'),
            ).toHaveCount(6);
            await expect(
              page
                .locator('.dashboard-nav')
                .getByRole('link', { name: 'Settings' }),
            ).toHaveCount(0);
          }
          await page.getByRole('button', { name: 'Manage account' }).click();
          await expect(page.locator('.cl-userProfile-root')).toBeVisible();
          await page.getByRole('button', { name: 'Close modal' }).click();
        }
      }
      for (const route of ['/dashboard', '/dashboard/courses']) {
        await page.goto(route);
        await expect(page.locator('.dashboard-shell')).toHaveAttribute(
          'data-dashboard-theme',
          theme,
        );
        await scan(page);
        if (route === '/dashboard')
          await expect(
            page.getByRole('heading', { name: 'No active learning yet.' }),
          ).toBeVisible();
        else {
          await page.getByRole('tab', { name: 'Viewed Courses' }).click();
          await expect(
            page.getByRole('heading', {
              name: 'Courses you explore will appear here.',
            }),
          ).toBeVisible();
        }
      }
      await page.goto('/dashboard');
      await page.reload();
      await expect(page.locator('.dashboard-shell')).toHaveAttribute(
        'data-dashboard-theme',
        theme,
      );
      expect(await (await page.request.get('/dashboard')).text()).toContain(
        `data-dashboard-theme="${theme}"`,
      );
      if (theme === 'dark')
        await page.screenshot({
          path: `${review}/${testInfo.project.name === 'd3-desktop' ? '1440' : '390'}-overview-dark.png`,
          fullPage: true,
        });
    }
    await page.goto('/');
    expect(
      await page
        .locator('body')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe(publicBackground);
    await expect(page.locator('[data-dashboard-theme]')).toHaveCount(0);
  } finally {
    await client.users.deleteUser(user.id);
  }
});
