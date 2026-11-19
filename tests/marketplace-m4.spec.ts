import { test, expect, type Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { testDatabaseUrl } from './helpers/d4-database';
import { signInTestAccount, refreshTestSession } from './helpers/clerk-session';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
const directory = 'docs/reviews/marketplace-m4';
let db: PrismaClient;
let fixtures: Record<string, { ref: string; intentRef: string; slug: string }>;
const captures: string[] = [];
test.beforeAll(async () => {
  await clerkSetup();
  if (!/^d4_[a-f0-9]{24}$/.test(process.env.D4_TEST_SCHEMA || ''))
    throw Error('Isolated Test schema required.');
  db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: testDatabaseUrl()! },
      { schema: process.env.D4_TEST_SCHEMA! },
    ),
  });
  fixtures = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'node_modules/tsx/dist/cli.mjs',
        'tests/helpers/marketplace-m4-browser-fixtures.ts',
      ],
      {
        env: { ...process.env, NODE_OPTIONS: '--conditions=react-server' },
        stdio: 'pipe',
      },
    ).toString(),
  );
});
test.afterAll(async () => {
  await mkdir(directory, { recursive: true });
  await writeFile(
    `${directory}/capture-manifest.json`,
    JSON.stringify({ captures }, null, 2) + '\n',
  );
  await db?.$disconnect();
});
async function capture(page: Page, name: string, axe = false) {
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.locator('.site-header [aria-label="Loading account"]:visible'),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (axe)
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: `${directory}/${name}.png`,
    fullPage: true,
    mask: [
      page.locator('.account-menu'),
      page.locator('.enrollment-account'),
      page.locator('.enrollment-layout > .enrollment-card > h2'),
      page.locator('.enrollment-card > p').filter({ hasText: '@' }),
      page.locator('.commerce-table td:nth-child(2)'),
      page.locator('.commerce-admin-details dd:first-of-type'),
    ],
  });
  captures.push(`${name}.png`);
}
test('M4 real authenticated private purchase states, finance authorization and responsive UI', async ({
  page,
  context,
}) => {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const owners = await clerk.users.getUserList({
    emailAddress: ['arcaderobo3@gmail.com'],
    limit: 2,
  });
  expect(owners.data).toHaveLength(1);
  let sessionId: string | null = null;
  const baseline = {
    enrollments: await db.enrollment.count(),
    progress: await db.lessonState.count(),
  };
  try {
    await setupClerkTestingToken({ page });
    await page.goto(`/orders/${fixtures.pending.ref}`);
    await expect(page).toHaveURL(/\/sign-in\?redirect_url=/);
    expect(new URL(page.url()).searchParams.get('redirect_url')).toBe(
      `/orders/${fixtures.pending.ref}`,
    );
    await signInTestAccount(page, owners.data[0].id);
    await refreshTestSession(page);
    sessionId = await page.evaluate(
      () =>
        (window as unknown as { Clerk: { session: { id: string } } }).Clerk
          .session.id,
    );
    const headings: Record<string, string> = {
      ready: 'Ready to pay',
      pending: 'Payment pending',
      failed: 'Payment failed — you can retry',
      paid: 'Payment successful',
      review: 'Payment needs review',
      refunded: 'Payment refunded',
    };
    for (const state of Object.keys(headings)) {
      await page.goto(`/orders/${fixtures[state].ref}?paid=true`);
      await expect(
        page.getByRole('heading', { name: headings[state], exact: true }),
      ).toBeVisible();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await capture(
          page,
          `${width}-order-${state}`,
          ['pending', 'paid', 'review'].includes(state),
        );
      }
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/orders/${fixtures.pending.ref}`);
    await capture(page, '320-order-pending', true);
    await page.getByRole('button', { name: 'Verify payment status' }).click();
    await expect(page.getByRole('status')).toContainText('unavailable');
    await expect(
      page.getByRole('heading', { name: 'Payment pending', exact: true }),
    ).toBeVisible();
    const response = await context.request.get(
      `/api/marketplace/commerce/orders/${fixtures.paid.ref}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    const data = await response.json();
    expect(data).not.toHaveProperty('userId');
    expect(data).not.toHaveProperty('providerSessionId');
    expect(
      (
        await context.request.get(
          `/api/marketplace/commerce/orders/${randomBytes(32).toString('base64url')}`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await context.request.post(
          `/api/marketplace/commerce/orders/${fixtures.pending.ref}/reconcile`,
          { headers: { origin: 'https://attacker.invalid' }, data: {} },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await context.request.put(
          `/api/marketplace/commerce/orders/${fixtures.pending.ref}`,
        )
      ).status(),
    ).toBe(405);
    await page.goto(`/checkout/${fixtures.ready.intentRef}`);
    await expect(
      page.getByRole('button', { name: 'Continue to Payment' }),
    ).toBeDisabled();
    await capture(page, '320-checkout-unconfigured', true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await capture(page, '1440-checkout-unconfigured', true);
    await page.goto(`/courses/${fixtures.paid.slug}`);
    await expect(
      page
        .locator('main')
        .getByRole('link', { name: 'Go to Dashboard' })
        .first(),
    ).toBeVisible();
    await page.goto('/admin/marketplace/orders');
    await expect(
      page.getByRole('heading', { name: 'Orders', exact: true }),
    ).toBeVisible();
    await capture(page, '1440-admin-orders', true);
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Dark mode', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await capture(page, '1440-admin-orders-dark', true);
    await page.setViewportSize({ width: 390, height: 1000 });
    await capture(page, '390-admin-orders-dark', true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await page.goto(`/admin/marketplace/orders/${fixtures.paid.ref}`);
    await expect(page.locator('.commerce-admin-details').first()).toContainText(
      'paid',
    );
    await capture(page, '1440-admin-order-detail', true);
    const owner = await db.user.findUniqueOrThrow({
      where: { clerkUserId: owners.data[0].id },
    });
    await db.adminAuthorization.update({
      where: { userId: owner.id },
      data: { permissions: ['MARKETPLACE_MANAGE'] },
    });
    expect(
      (await context.request.get('/api/admin/marketplace/commerce')).status(),
    ).toBe(403);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Access unavailable', exact: true }),
    ).toBeVisible();
    const other = await context.browser()!.newContext();
    expect(
      (
        await other.request.get(
          `/api/marketplace/commerce/orders/${fixtures.paid.ref}`,
        )
      ).status(),
    ).toBe(401);
    await other.close();
    expect(await db.enrollment.count()).toBe(baseline.enrollments);
    expect(await db.lessonState.count()).toBe(baseline.progress);
  } finally {
    if (sessionId)
      await clerk.sessions.revokeSession(sessionId).catch(() => {});
  }
});
