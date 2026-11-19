import { test, expect, type Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { testDatabaseUrl } from './helpers/d4-database';
import { signInTestAccount, refreshTestSession } from './helpers/clerk-session';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const origin = 'http://127.0.0.1:3113',
  directory = 'docs/reviews/marketplace-m3';
let db: PrismaClient;
const captures: string[] = [];
test.beforeAll(async () => {
  if (!/^d4_[a-f0-9]{24}$/.test(process.env.D4_TEST_SCHEMA || ''))
    throw Error('Isolated local Test schema required.');
  await clerkSetup();
  db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: testDatabaseUrl()! },
      { schema: process.env.D4_TEST_SCHEMA! },
    ),
  });
  await db.marketplaceOffering.create({
    data: {
      slug: 'm3-browser-program',
      title: 'M3 Practical AI Foundations',
      shortDescription:
        'A thoughtful foundation in practical technology and creative problem solving.',
      category: 'Technology',
      deliveryMode: 'ONLINE',
      durationLabel: '12 weeks',
      priceMinor: 1500000,
      currency: 'INR',
      availabilityStatus: 'OPEN',
      publicationStatus: 'PUBLISHED',
      publishedAt: new Date(),
      cohortStartsAt: new Date('2027-01-15T09:00:00Z'),
    },
  });
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
  await page.evaluate(() => window.scrollTo(0, 0));
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
      page.locator('.enrollment-account'),
      page.locator('.account-menu'),
      page.locator('.enrollment-card > p').filter({ hasText: '@' }),
    ],
  });
  captures.push(`${name}.png`);
}
test('M3 real Development auth return, secure claim, progressive onboarding, resume and private checkout', async ({
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
  const baseline = {
    enrollments: await db.enrollment.count(),
    lessons: await db.lessonState.count(),
  };
  try {
    await setupClerkTestingToken({ page });
    await page.goto('/courses/m3-browser-program');
    await expect(
      page.getByRole('button', { name: 'Enroll Now', exact: true }).first(),
    ).toBeVisible();
    await capture(page, '1440-program-signed-out');
    await page
      .getByRole('button', { name: 'Enroll Now', exact: true })
      .first()
      .click();
    await page.waitForURL('**/sign-in?redirect_url=**');
    const destination = new URL(page.url()).searchParams.get('redirect_url')!;
    expect(destination).toMatch(/^\/enroll\/[A-Za-z0-9_-]{43}$/);
    const ref = destination.split('/')[2];
    const cookie = (await context.cookies()).find(
      (c) => c.name === 'mentoralm-enrollment',
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    await context.addCookies([{ ...cookie!, expires: Date.now() / 1000 + 60 }]);
    const repeated = await context.request.post('/api/marketplace/enrollment', {
      headers: { origin },
      data: { slug: 'm3-browser-program' },
    });
    expect(repeated.status()).toBe(200);
    expect((await repeated.json()).ref).toBe(ref);
    expect(
      (await context.cookies()).find((c) => c.name === 'mentoralm-enrollment')!
        .expires,
    ).toBeGreaterThan(Date.now() / 1000 + 23 * 3600);

    await expect(
      page.getByRole('link', { name: 'Create Account', exact: true }),
    ).toHaveAttribute(
      'href',
      `/sign-up?redirect_url=${encodeURIComponent(destination)}`,
    );
    await page
      .getByRole('link', { name: 'Create Account', exact: true })
      .click();
    await expect(
      page.getByRole('link', { name: 'Login', exact: true }),
    ).toHaveAttribute(
      'href',
      `/sign-in?redirect_url=${encodeURIComponent(destination)}`,
    );
    await page.getByRole('link', { name: 'Login', exact: true }).click();
    await signInTestAccount(page, owners.data[0].id);
    await refreshTestSession(page);
    sessionId = await page.evaluate(
      () =>
        (window as unknown as { Clerk: { session: { id: string } } }).Clerk
          .session.id,
    );
    await page.goto(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
    await page.waitForURL(`**${destination}`);
    await expect(
      page.getByRole('button', { name: 'Save & continue' }),
    ).toBeEnabled();
    await expect
      .poll(
        async () =>
          (
            await db.marketplaceEnrollmentIntent.findUniqueOrThrow({
              where: { publicRef: ref },
            })
          ).userId,
      )
      .not.toBeNull();
    for (const width of [1672, 1440, 1024, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await capture(
        page,
        `${width}-onboarding-about`,
        width === 1440 || width === 390,
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByLabel('Full name', { exact: true })
      .fill('Synthetic Learner');
    await page.getByLabel('Phone (with country code)').fill('bad');
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await expect(page.locator('.enrollment-error-summary')).toContainText(
      'review',
    );
    await expect(page.getByLabel('Phone (with country code)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page.locator('.enrollment-error-summary')).toBeFocused();
    await capture(page, '1440-onboarding-errors', true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Phone (with country code)').fill('+919876543210');
    await page.getByLabel('City', { exact: true }).fill('Pune');
    await page.getByLabel('State / region').fill('Maharashtra');
    await page.getByLabel('Country', { exact: true }).fill('India');
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await expect(
      page.getByRole('heading', { name: 'Education & status', exact: true }),
    ).toBeFocused();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Education & status', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Education level').selectOption('UNDERGRADUATE');
    await page.getByLabel('Current status').selectOption('COLLEGE_STUDENT');
    await page
      .getByLabel('Institution / organization (optional)')
      .fill('Synthetic Institute');
    await capture(page, '390-onboarding-education', true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await page
      .getByLabel('What would you like to achieve?')
      .fill('Build practical skills through thoughtful projects.');
    await page
      .getByLabel('How did you find us? (optional)')
      .fill('Synthetic browser test');
    await capture(page, '1440-onboarding-goal', true);
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await capture(page, '1440-onboarding-review', true);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Review checkout summary' }).click();
    await page.waitForURL(`**/checkout/${ref}`);
    await expect(
      page.getByRole('heading', { name: 'Review your enrollment' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Continue to Payment' }),
    ).toBeDisabled();
    await expect(page.locator('.enrollment-price')).toHaveText('₹15,000.00');
    await expect(page.locator('main')).toContainText('Synthetic Learner');
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Enrollment details confirmed' }),
    ).toBeVisible();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await capture(page, `${width}-checkout`, width !== 320);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await context.request.get(
      `/api/marketplace/enrollment/${ref}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('private');
    expect(response.headers()['cache-control']).toContain('no-store');
    const payload = await response.json();
    expect(payload).not.toHaveProperty('userId');
    expect(payload).not.toHaveProperty('browserHash');
    expect(
      (
        await context.request.put(`/api/marketplace/enrollment/${ref}`)
      ).status(),
    ).toBe(405);
    expect(
      (
        await context.request.post(`/api/marketplace/enrollment/${ref}/steps`, {
          headers: { origin: 'https://attacker.invalid' },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await context.request.get(
          `/api/marketplace/enrollment/${randomBytes(32).toString('base64url')}`,
        )
      ).status(),
    ).toBe(404);
    const shared = await context.browser()!.newContext();
    const other = await shared.newPage();
    await setupClerkTestingToken({ page: other });
    await other.goto(`/checkout/${ref}`);
    await expect(other).toHaveURL(/\/sign-in\?redirect_url=/);
    expect(
      (await shared.request.get(`/api/marketplace/enrollment/${ref}`)).status(),
    ).toBe(401);
    await shared.close();
    await page.goto('/courses/m3-browser-program');
    await refreshTestSession(page);
    await page
      .getByRole('button', { name: 'Enroll Now', exact: true })
      .first()
      .click();
    await page.waitForURL(`**/enroll/${ref}`);
    await expect(
      page.getByRole('heading', { name: 'Review', exact: true }),
    ).toBeVisible();
    await db.marketplaceOffering.update({
      where: { slug: 'm3-browser-program' },
      data: { availabilityStatus: 'CLOSED' },
    });
    await page.goto(`/checkout/${ref}`);
    await expect(
      page.getByRole('heading', {
        name: 'This program is currently unavailable',
      }),
    ).toBeVisible();
    await capture(page, '1440-checkout-closed', true);
    await db.marketplaceOffering.update({
      where: { slug: 'm3-browser-program' },
      data: { availabilityStatus: 'OPEN' },
    });
    const owner = await db.user.findUniqueOrThrow({
        where: { clerkUserId: owners.data[0].id },
      }),
      offering = await db.marketplaceOffering.findUniqueOrThrow({
        where: { slug: 'm3-browser-program' },
      }),
      expiredRef = randomBytes(32).toString('base64url');
    await db.marketplaceEnrollmentIntent.create({
      data: {
        publicRef: expiredRef,
        userId: owner.id,
        offeringId: offering.id,
        titleSnapshot: offering.title,
        priceMinor: offering.priceMinor!,
        currency: offering.currency,
        durationLabel: offering.durationLabel,
        deliveryMode: offering.deliveryMode,
        state: 'ONBOARDING_REQUIRED',
        createdAt: new Date(Date.now() - 86400001),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await page.goto(`/enroll/${expiredRef}`);
    await expect(
      page.getByRole('heading', { name: 'This enrollment has expired' }),
    ).toBeVisible();
    await capture(page, '1440-enrollment-expired', true);
    await page.goto(`/checkout/${ref}`);
    await page
      .getByRole('button', { name: 'Cancel enrollment', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Enrollment cancelled', exact: true }),
    ).toBeVisible();
    expect(await db.enrollment.count()).toBe(baseline.enrollments);
    expect(await db.lessonState.count()).toBe(baseline.lessons);
  } finally {
    if (sessionId)
      await clerk.sessions.revokeSession(sessionId).catch(() => {});
    await db.marketplaceOffering.update({
      where: { slug: 'm3-browser-program' },
      data: { availabilityStatus: 'OPEN' },
    });
  }
});
