import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { localSeedUrl } from '../scripts/lms-owner/safety';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {
  productThemeCookieAttributes,
  resolveProductTheme,
} from '../src/lib/dashboard/theme';
loadEnvConfig(process.cwd(), true);
test('shared product theme, complete LMS surfaces and accessible responsive controls', async ({
  page,
  context,
}) => {
  expect(productThemeCookieAttributes('mentoralm.com', 'https:')).toContain(
    '; Domain=mentoralm.com',
  );
  expect(
    productThemeCookieAttributes('students.mentoralm.com', 'https:'),
  ).toContain('; Secure');
  for (const host of [
    '127.0.0.1',
    'localhost',
    'preview.mentoralm.com',
    'mentoralm.com.evil.example',
  ]) {
    expect(productThemeCookieAttributes(host, 'https:')).not.toContain(
      'Domain=',
    );
  }
  expect(productThemeCookieAttributes('mentoralm.com', 'http:')).not.toContain(
    'Domain=',
  );
  expect(resolveProductTheme(undefined, 'dark', 'light')).toBe('dark');
  expect(resolveProductTheme('light', 'dark', 'dark')).toBe('light');
  expect(resolveProductTheme('invalid', undefined, 'dark')).toBe('dark');
  const url = localSeedUrl(process.env),
    owner = process.env.LMS_UI_OWNER;
  if (!owner)
    throw Error(
      'LMS_UI_OWNER must explicitly identify the existing seeded Development account.',
    );
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const users = owner.startsWith('user_')
    ? [await clerk.users.getUser(owner)]
    : (await clerk.users.getUserList({ emailAddress: [owner], limit: 2 })).data;
  if (users.length !== 1)
    throw Error('Exactly one existing Development identity is required.');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema: 'public' }),
  });
  let tokenId: string | undefined,
    testSessionId: string | undefined,
    newAttemptId: string | undefined;
  try {
    const actor = await db.user.findUniqueOrThrow({
      where: { clerkUserId: users[0].id },
    });
    const course = await db.course.findFirstOrThrow({
      where: {
        id: { startsWith: 'local_owner_' },
        enrollments: { some: { userId: actor.id } },
      },
    });
    const lesson = await db.learningItem.findFirstOrThrow({
      where: {
        section: { courseId: course.id },
        type: 'LESSON',
        lesson: { format: 'TEXT' },
      },
      orderBy: { position: 'asc' },
    });
    const ticket = await clerk.signInTokens.createSignInToken({
      userId: users[0].id,
      expiresInSeconds: 180,
    });
    tokenId = ticket.id;
    await page.goto('/sign-in');
    await page.waitForFunction(
      () =>
        !!(window as unknown as { Clerk?: { loaded: boolean } }).Clerk?.loaded,
    );
    testSessionId = await page.evaluate(async (ticket) => {
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
    }, ticket.token);
    await mkdir('docs/reviews/lms-theme', { recursive: true });
    const assignment = await db.learningItem.findFirstOrThrow({
      where: { section: { courseId: course.id }, type: 'ASSIGNMENT' },
    });
    const activities = await db.learningItem.findMany({
      where: {
        section: { courseId: course.id },
        type: { in: ['QUIZ', 'ASSESSMENT'] },
      },
    });
    const routes = [
      ['home', '/learn'],
      ['lectures', '/learn/lectures'],
      ['player', `/learn/courses/${course.id}/lessons/${lesson.id}`],
      ['assignments', '/learn/assignments'],
      ['resources', '/learn/resources'],
      ['attendance', '/learn/attendance'],
      ['discussions', '/learn/discussions'],
      ['certificates', '/learn/certificates'],
      [
        'assignment-detail',
        `/learn/courses/${course.id}/assignments/${assignment.id}`,
      ],
      ...activities.map((a) => [
        a.type.toLowerCase(),
        `/learn/courses/${course.id}/activities/${a.id}`,
      ]),
    ];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
    async function ready(theme: string) {
      await expect(page.locator('.lms-content h1').first()).toBeVisible();
      await expect(page.locator('.lms-content [aria-busy="true"]')).toHaveCount(
        0,
      );
      await expect(page.locator('.lms-shell')).toHaveAttribute(
        'data-lms-theme',
        theme,
      );
      await expect(toggle).toHaveAttribute(
        'aria-pressed',
        String(theme === 'dark'),
      );
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    async function axe() {
      const result = await new AxeBuilder({ page })
        .include('.lms-shell')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      ).toEqual([]);
    }
    await page.goto('/learn');
    await ready('dark');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await ready('light');
    await page.getByRole('link', { name: 'Learn', exact: true }).click();
    await ready('light');
    await page.getByRole('link', { name: 'Assignments', exact: true }).click();
    await ready('light');
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') {
        await toggle.click();
        await ready('dark');
      }
      for (const [name, path] of routes) {
        await page.goto(path);
        await ready(theme);
        await axe();
        // Verify the server markup already has the saved theme before hydration.
        const response = await context.request.get(path);
        expect(await response.text()).toContain(`data-lms-theme="${theme}"`);
        if (
          (theme === 'light' &&
            ['home', 'lectures', 'player'].includes(name)) ||
          (theme === 'dark' && name === 'home')
        ) {
          await page.screenshot({
            path: `docs/reviews/lms-theme/1440-${name}-${theme}.png`,
            fullPage: true,
          });
        }
      }
      await page.reload();
      await ready(theme);
      await page
        .getByRole('link', { name: 'Student Dashboard ↗', exact: true })
        .click();
      await expect(page.locator('.dashboard-shell')).toHaveAttribute(
        'data-dashboard-theme',
        theme,
      );
      await page
        .getByRole('button', { name: 'Dark mode', exact: true })
        .click();
      await page.goto('/learn');
      await ready(theme === 'light' ? 'dark' : 'light');
      await toggle.click();
      await ready(theme);
    }
    // Inspect the real question controls in both palettes, preserving prior owner work.
    const quiz = activities.find((a) => a.type === 'QUIZ');
    if (
      quiz &&
      !(await db.academicAttempt.count({
        where: { userId: actor.id, activityId: quiz.id },
      }))
    ) {
      await page.goto(`/learn/courses/${course.id}/activities/${quiz.id}`);
      const started = page.waitForResponse(
        (r) =>
          r.url().endsWith(`/activities/${quiz.id}/start`) &&
          r.request().method() === 'POST',
      );
      await page
        .getByRole('button', { name: 'Start quiz', exact: true })
        .click();
      newAttemptId = ((await (await started).json()) as { id: string }).id;
      await expect(page.getByRole('radio').first()).toBeVisible();
      await ready('dark');
      await axe();
      await toggle.click();
      await ready('light');
      await axe();
    } else {
      await toggle.click();
      await ready('light');
    }
    await page.setViewportSize({ width: 820, height: 1000 });
    for (const [, path] of routes.slice(0, 3)) {
      await page.goto(path);
      await ready('light');
      await axe();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [name, path] of [routes[0], routes[2]]) {
      await page.goto(path);
      await ready('light');
      await axe();
      await page.screenshot({
        path: `docs/reviews/lms-theme/390-${name}-light.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole('button', { name: 'Course Outline', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await axe();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Course Outline', exact: true }),
    ).toBeFocused();
    await context.clearCookies({ name: 'mentoralm-product-theme' });
    await context.addCookies([
      {
        name: 'mentoralm-dashboard-theme',
        value: 'dark',
        domain: '127.0.0.1',
        path: '/dashboard',
      },
    ]);
    await page.goto('/dashboard');
    await expect(page.locator('.dashboard-shell')).toHaveAttribute(
      'data-dashboard-theme',
      'dark',
    );
    await expect
      .poll(
        async () =>
          (await context.cookies()).find(
            (c) => c.name === 'mentoralm-product-theme',
          )?.value,
      )
      .toBe('dark');
    await page.goto('/learn');
    await ready('dark');
    await toggle.click();
    await ready('light');
    await page.goto('/');
    const publicLight = await page.locator('.hero').evaluate((el) => ({
      background: getComputedStyle(el).background,
      color: getComputedStyle(el).color,
    }));
    await context.addCookies([
      {
        name: 'mentoralm-product-theme',
        value: 'dark',
        url: 'http://127.0.0.1:3000',
      },
    ]);
    await page.reload();
    expect(
      await page.locator('.hero').evaluate((el) => ({
        background: getComputedStyle(el).background,
        color: getComputedStyle(el).color,
      })),
    ).toEqual(publicLight);
    await expect(
      page.locator('[data-lms-theme], [data-dashboard-theme]'),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      'Both themes: 11 LMS surfaces, persistence/reload/SSR markup, Dashboard handoff, public isolation, responsive overflow and WCAG AA passed. Exactly six prescribed captures.',
    );
  } finally {
    // Only this test's newly created, still-draft attempt is removed; pre-existing student work is never changed.
    if (newAttemptId)
      await db.academicAttempt.deleteMany({
        where: {
          id: newAttemptId,
          user: { clerkUserId: users[0].id },
          status: 'IN_PROGRESS',
        },
      });
    if (testSessionId)
      await clerk.sessions.revokeSession(testSessionId).catch(() => {});

    if (tokenId)
      await clerk.signInTokens.revokeSignInToken(tokenId).catch(() => {});
    await db.$disconnect();
  }
});
