import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { localSeedUrl, verifyDatabase } from '../scripts/lms-owner/safety';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
loadEnvConfig(process.cwd(), true);
test('signed-out entry, safe deep return and responsive themes', async ({
  page,
  context,
}) => {
  const productionRoot = await context.request.get('/', {
    headers: { host: 'students.mentoralm.com' },
    maxRedirects: 0,
  });
  expect(productionRoot.status()).toBe(307);
  expect(productionRoot.headers().location).toBe(
    'https://students.mentoralm.com/sign-in?redirect_url=%2Flearn',
  );
  const deep =
    '/learn/courses/local_owner_1dd841f253c80d4e_course/lessons/lesson_example';
  await context.addCookies([
    {
      name: '__session',
      value: 'invalid-expired-session',
      url: 'http://127.0.0.1:3000',
    },
  ]);
  await page.goto(deep);
  await expect(page).toHaveURL(
    `/lms-auth/sign-in?redirect_url=${encodeURIComponent(deep)}`,
  );
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await mkdir('docs/reviews/lms-auth', { recursive: true });
  for (const theme of ['light', 'dark']) {
    await context.addCookies([
      {
        name: 'mentoralm-product-theme',
        value: theme,
        url: 'http://127.0.0.1:3000',
      },
    ]);
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const html = await (
        await context.request.get('/lms-auth/sign-in')
      ).text();
      expect(html).toContain(`data-lms-theme="${theme}"`);
      await page.goto('/lms-auth/sign-in');
      await expect(page.getByLabel('Email address')).toBeVisible();
      await expect(page.locator('.lms-shell')).toHaveAttribute(
        'data-lms-theme',
        theme,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByLabel('Email address').focus();
      await expect(page.getByLabel('Email address')).toBeFocused();
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() => document.activeElement?.tagName),
      ).not.toBe('BODY');
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations).toEqual([]);
      await page.screenshot({
        path: `docs/reviews/lms-auth/${theme}-${width}.png`,
      });
    }
  }
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('.lms-shell')).toHaveAttribute(
    'data-lms-theme',
    'light',
  );
  await page.reload();
  await expect(page.locator('.lms-shell')).toHaveAttribute(
    'data-lms-theme',
    'light',
  );
  await page.goto('/lms-auth/sign-in?redirect_url=https%3A%2F%2Fevil.example');
  await expect(
    page.getByText('We’ll continue at your learning home after sign-in.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/lms-auth\/sign-up\?redirect_url=%2Flearn/);
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.goto('/learn');
  await expect(page).toHaveURL('/lms-auth/sign-in?redirect_url=%2Flearn');
});
test('existing shared account skips entry and preserves course authorization, support, profile and logout', async ({
  page,
}) => {
  const url = localSeedUrl(process.env),
    owner = process.env.LMS_UI_OWNER;
  if (!owner) throw Error('Explicit seeded Development owner required.');
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const users = owner.startsWith('user_')
    ? [await clerk.users.getUser(owner)]
    : (await clerk.users.getUserList({ emailAddress: [owner], limit: 2 })).data;
  if (users.length !== 1) throw Error('Exactly one existing owner required.');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema: 'public' }),
  });
  let tokenId: string | undefined, sessionId: string | undefined;
  try {
    await verifyDatabase(db);
    const actor = await db.user.findUniqueOrThrow({
      where: { clerkUserId: users[0].id },
    });
    const token = await clerk.signInTokens.createSignInToken({
      userId: users[0].id,
      expiresInSeconds: 180,
    });
    tokenId = token.id;
    await page.goto('/lms-auth/sign-in');
    await page.waitForFunction(
      () =>
        !!(window as unknown as { Clerk?: { loaded: boolean } }).Clerk?.loaded,
    );
    sessionId = await page.evaluate(async (ticket) => {
      const clerk = (
        window as unknown as {
          Clerk: {
            client: {
              signIn: {
                create: (input: {
                  strategy: string;
                  ticket: string;
                }) => Promise<{ createdSessionId: string }>;
              };
            };
            setActive: (input: { session: string }) => Promise<void>;
          };
        }
      ).Clerk;
      const attempt = await clerk.client.signIn.create({
        strategy: 'ticket',
        ticket,
      });
      await clerk.setActive({ session: attempt.createdSessionId });
      return attempt.createdSessionId;
    }, token.token);
    const course = await db.enrollment.findFirstOrThrow({
      where: { userId: actor.id },
      select: { courseId: true },
    });
    await page.goto(
      `/lms-auth/sign-in?redirect_url=${encodeURIComponent(`/learn/courses/${course.courseId}`)}`,
    );
    await expect(page).toHaveURL(`/learn/courses/${course.courseId}`);
    await expect(page.locator('.lms-shell')).toBeVisible();
    const lessonLink = page.locator('a[href*="/lessons/"]').first();
    await expect(lessonLink).toBeVisible();
    const lessonPath = await lessonLink.getAttribute('href');
    if (!lessonPath) throw Error('Owner course lesson link required.');
    await page.goto(
      `/lms-auth/sign-in?redirect_url=${encodeURIComponent(lessonPath)}`,
    );
    await expect(page).toHaveURL(lessonPath);
    await expect(page.locator('.lms-content h1').first()).toBeVisible();
    await page.goto('/learn/courses/foreign-course');
    await expect(
      page.getByRole('heading', { name: 'Course not available' }),
    ).toBeVisible();
    for (const path of ['/learn/support', '/learn/profile', '/dashboard']) {
      await page.goto(path);
      await expect(page).toHaveURL(path);
      await expect(page.locator('h1').first()).toBeVisible();
    }
    await page.goto('/learn');
    await page.getByRole('button', { name: /Open account menu for/ }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/lms-auth\/sign-in/);
  } finally {
    if (sessionId)
      await clerk.sessions.revokeSession(sessionId).catch(() => {});
    if (tokenId)
      await clerk.signInTokens.revokeSignInToken(tokenId).catch(() => {});
    await db.$disconnect();
  }
});

test('real Development signup stays unentitled, supports contacting Support and logs out', async ({
  page,
  context,
}) => {
  const url = localSeedUrl(process.env);
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema: 'public' }),
  });
  const email = `mentoralm-lms-auth-${Date.now()}+clerk_test@example.com`;
  const { clerkSetup, setupClerkTestingToken } =
    await import('@clerk/testing/playwright');
  try {
    await verifyDatabase(db);
    await clerkSetup();
    await setupClerkTestingToken({ page });
    await page.goto('/lms-auth/sign-up');
    await page.getByLabel('Email address').fill(email);
    await page
      .getByLabel('Password', { exact: true })
      .fill('Ephemeral-Only-Lms-Check!7341');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText('Verify your email')).toBeVisible();
    // Clerk reserves +clerk_test email addresses for OTP 424242; no email is sent.
    const codes = page.locator('input[inputmode="numeric"]');
    if ((await codes.count()) === 6)
      for (let i = 0; i < 6; i++) await codes.nth(i).fill('424242'[i]);
    else await codes.first().fill('424242');
    const verify = page.getByRole('button', { name: /verify|continue/i });
    if ((await verify.count()) && (await verify.first().isVisible()))
      await verify.first().click();
    await expect(
      page.getByRole('heading', { name: 'Learning access unavailable' }),
    ).toBeVisible();
    const users = (
      await clerk.users.getUserList({ emailAddress: [email], limit: 2 })
    ).data;
    expect(users).toHaveLength(1);
    const actor = await db.user.findUniqueOrThrow({
      where: { clerkUserId: users[0].id },
    });
    expect(actor.lmsAccessOverride).toBeNull();
    expect(await db.enrollment.count({ where: { userId: actor.id } })).toBe(0);
    expect(
      await db.batchMembership.count({ where: { userId: actor.id } }),
    ).toBe(0);
    expect(
      (await context.request.get('/api/lms/account/profile')).status(),
    ).toBe(403);
    await page.getByRole('button', { name: 'Contact Support' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByLabel('Subject', { exact: true })
      .fill('Temporary auth validation');
    await page
      .getByLabel('Message', { exact: true })
      .fill('Please help with my learning access. Test ticket.');
    await page
      .getByRole('button', { name: 'Submit ticket', exact: true })
      .click();
    await expect(
      page.getByText('Your support ticket has been created.'),
    ).toBeVisible();
    await page.goto('/lms-auth/sign-in');
    await expect(
      page.getByRole('heading', { name: 'Learning access unavailable' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/lms-auth\/sign-in/);
    await expect(page.getByLabel('Email address')).toBeVisible();
    expect(
      (await context.request.get('/api/lms/account/profile')).status(),
    ).toBe(401);
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await page.getByText('Forgot password?', { exact: true }).click();
    await expect(
      page.getByText('Reset your password', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Reset your password', exact: true })
      .click();
    await expect(
      page.locator('input[inputmode="numeric"]').first(),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toMatch(/^\/lms-auth\/sign-in/);
  } finally {
    // Cleanup only the unique test identity, never the owner or another existing user.
    const users = (
      await clerk.users.getUserList({ emailAddress: [email], limit: 2 })
    ).data;
    for (const user of users) {
      if (user.emailAddresses.some((e) => e.emailAddress === email)) {
        const actor = await db.user.findUnique({
          where: { clerkUserId: user.id },
        });
        if (actor)
          await db.supportTicket.deleteMany({ where: { userId: actor.id } });
        await db.user.deleteMany({ where: { clerkUserId: user.id } });
        await clerk.users.deleteUser(user.id);
      }
    }
    await db.$disconnect();
  }
});
