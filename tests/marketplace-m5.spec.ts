import { test, expect, type Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { testDatabaseUrl } from './helpers/d4-database';
import { signInTestAccount, refreshTestSession } from './helpers/clerk-session';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const directory = 'docs/reviews/marketplace-m5',
  origin = 'http://127.0.0.1:3113';
let db: PrismaClient,
  fixtures: Record<
    string,
    {
      orderRef: string;
      deliveryRef: string;
      courseId: string | null;
      slug: string;
      title: string;
    }
  >;
const captures: string[] = [];
test.beforeAll(async () => {
  await clerkSetup();
  if (!/^d4_[a-f0-9]{24}$/.test(process.env.D4_TEST_SCHEMA || ''))
    throw Error('Isolated schema required.');
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
        'tests/helpers/marketplace-m5-browser-fixtures.ts',
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
async function capture(page: Page, name: string, axe = true) {
  await page.evaluate(() => document.fonts.ready);
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
      page.locator('.dashboard-user'),
      page.locator('.dashboard-account'),
      page.locator('.account-menu'),
      page.locator('.account-avatar'),
      page.locator('.commerce-admin-details').first().locator('dd').first(),
      page.locator('.lms-account'),
      page.locator('.lms-profile-person'),
      page.locator('.dashboard-welcome h1'),
    ],
  });
  captures.push(`${name}.png`);
}
test('M5 purchased customer journey, private delivery states, native Dashboard, LMS and Admin retry', async ({
  page,
  context,
}) => {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }),
    owners = await clerk.users.getUserList({
      emailAddress: ['arcaderobo3@gmail.com'],
      limit: 2,
    });
  expect(owners.data).toHaveLength(1);
  let sessionId: string | null = null;
  try {
    await setupClerkTestingToken({ page });
    await page.goto('/dashboard/programs');
    await expect(page).toHaveURL(/\/sign-in/);
    await signInTestAccount(page, owners.data[0].id);
    await refreshTestSession(page);
    sessionId = await page.evaluate(
      () =>
        (window as unknown as { Clerk: { session: { id: string } } }).Clerk
          .session.id,
    );
    await page.goto('/dashboard/programs');
    await expect(
      page.getByRole('heading', { name: 'My Programs', exact: true }),
    ).toBeVisible();
    const cards = page.locator('.my-program-card');
    await expect(cards).toHaveCount(5);
    await expect(page.locator('.my-programs')).not.toContainText(
      fixtures.refunded.title,
    );
    await expect(page.locator('.my-programs')).not.toContainText(
      'Another customer private purchase',
    );
    const active = cards.filter({ hasText: fixtures.active.title }),
      pending = cards.filter({ hasText: fixtures.pending.title }),
      failed = cards.filter({ hasText: fixtures.failed.title }),
      external = cards.filter({ hasText: fixtures.external.title });
    await expect(
      active.getByRole('link', { name: 'Continue Learning' }),
    ).toHaveAttribute('href', `/learn/courses/${fixtures.active.courseId}`);
    await expect(pending).toContainText('Preparing your access');
    await expect(pending).not.toContainText('Continue Learning');
    await expect(failed).toContainText('Access needs attention');
    await expect(
      failed.getByRole('link', { name: 'Contact Support' }),
    ).toHaveAttribute('href', '/dashboard/support');
    await expect(external).toContainText('Program purchased');
    await page.getByRole('link', { name: 'Purchase details' }).first().focus();
    await expect(
      page.getByRole('link', { name: 'Purchase details' }).first(),
    ).toBeFocused();
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'My Programs', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.my-program-card')).toHaveCount(5);
    await capture(page, '1440-dashboard-overview-programs-light');
    await page.goto('/dashboard/programs');
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await capture(page, `${width}-my-programs-light`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await capture(page, '1440-my-programs-dark');
    await page.setViewportSize({ width: 390, height: 1000 });
    await capture(page, '390-my-programs-dark');
    const response = await context.request.get(
      '/api/marketplace/delivery/programs?userId=another',
    );
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    const json = await response.json();
    expect(json.items).toHaveLength(5);
    expect(JSON.stringify(json)).not.toContain(
      'Another customer private purchase',
    );
    expect(
      (
        await context.request.post(
          `/api/marketplace/delivery/${fixtures.pending.deliveryRef}/retry`,
          { headers: { origin }, data: {} },
        )
      ).status(),
    ).toBe(405);
    const anonymous = await context.browser()!.newContext();
    expect(
      (
        await anonymous.request.get('/api/marketplace/delivery/programs')
      ).status(),
    ).toBe(401);
    const publicPage = await anonymous.newPage();
    await setupClerkTestingToken({ page: publicPage });
    await publicPage.goto(`/courses/${fixtures.active.slug}`);
    await expect(
      publicPage
        .getByRole('button', { name: 'Enroll Now', exact: true })
        .first(),
    ).toBeVisible();
    await anonymous.close();
    await page.goto(`/courses/${fixtures.active.slug}`);
    await expect(
      page
        .locator('main')
        .getByRole('link', { name: 'Go to Dashboard' })
        .first(),
    ).toHaveAttribute('href', '/dashboard/programs');
    await page.goto(`/learn/courses/${fixtures.active.courseId}`);
    await expect(page.locator('main')).toContainText('M5 practical learning');
    await page.goto(`/learn/courses/${fixtures.refunded.courseId}`);
    await expect(page.locator('.lms-boundary,main').first()).not.toContainText(
      'Course resources',
    );
    await page.goto(`/orders/${fixtures.refunded.orderRef}`);
    await expect(
      page.getByRole('heading', { name: 'Payment refunded', exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/admin/marketplace/orders/${fixtures.review.orderRef}`);
    await expect(
      page.getByRole('heading', { name: 'Delivery', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Retry Provisioning' }),
    ).toBeVisible();
    await capture(page, '1440-admin-delivery-review-dark');
    expect(
      (
        await context.request.post(
          `/api/admin/marketplace/delivery/${fixtures.review.deliveryRef}/retry`,
          { headers: { origin: 'https://attacker.invalid' }, data: {} },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await context.request.post(
          `/api/admin/marketplace/delivery/${fixtures.review.deliveryRef}/retry`,
          { headers: { origin }, data: { status: 'ACTIVE' } },
        )
      ).status(),
    ).toBe(400);
    await db.course.update({
      where: { id: fixtures.review.courseId! },
      data: { published: true },
    });
    await page.getByRole('button', { name: 'Retry Provisioning' }).click();
    await expect(page.locator('.commerce-admin-details').last()).toContainText(
      'active',
    );
    await capture(page, '1440-admin-delivery-active-dark');
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await capture(page, '1440-admin-delivery-active-light');
    await page.setViewportSize({ width: 390, height: 1000 });
    await capture(page, '390-admin-delivery-active-light');
    const owner = await db.user.findUniqueOrThrow({
      where: { clerkUserId: owners.data[0].id },
    });
    await db.adminAuthorization.update({
      where: { userId: owner.id },
      data: { permissions: ['COMMERCE_VIEW'] },
    });
    expect(
      (
        await context.request.post(
          `/api/admin/marketplace/delivery/${fixtures.pending.deliveryRef}/retry`,
          { headers: { origin }, data: {} },
        )
      ).status(),
    ).toBe(403);
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Retry Provisioning' }),
    ).toHaveCount(0);
    await db.user.update({
      where: { id: owner.id },
      data: { role: 'INSTRUCTOR' },
    });
    await page.goto('/dashboard/programs');
    await expect(
      page.getByRole('heading', { name: 'My Programs', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Continue Learning' }),
    ).not.toHaveCount(0);
    await page.goto('/learn');
    await expect(
      page.getByText('Learning access unavailable', { exact: true }),
    ).toHaveCount(0);
    await page.goto('/learn/profile');
    await expect(
      page.getByRole('heading', { name: 'Profile', exact: true }),
    ).toBeVisible();
    await capture(page, '390-marketplace-learner-profile');
    expect(
      (await context.request.get('/api/lms/account/profile')).status(),
    ).toBe(200);
    expect(
      (
        await context.request.patch('/api/lms/account/profile', {
          headers: { origin },
          data: { role: 'ADMIN' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await context.request.patch('/api/lms/account/profile', {
          headers: { origin: 'https://attacker.invalid' },
          data: {},
        })
      ).status(),
    ).toBe(403);
    await db.user.update({
      where: { id: owner.id },
      data: { lmsAccessOverride: 'DISABLED' },
    });
    expect(
      (await context.request.get('/api/lms/account/profile')).status(),
    ).toBe(403);
    await db.user.update({
      where: { id: owner.id },
      data: { lmsAccessOverride: null },
    });
    await page.goto('/dashboard/support');
    await expect(
      page.getByRole('heading', { name: 'Support', exact: true }),
    ).toBeVisible();
    await capture(page, '390-non-student-customer-support');
  } finally {
    if (sessionId)
      await clerk.sessions.revokeSession(sessionId).catch(() => {});
  }
});
