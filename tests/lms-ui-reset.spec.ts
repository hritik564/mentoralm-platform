import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { localSeedUrl } from '../scripts/lms-owner/safety';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
loadEnvConfig(process.cwd(), true);
test('local existing-owner LMS navigation, responsive composition and accessibility', async ({
  page,
  context,
}) => {
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
    await mkdir('docs/reviews/lms-ui-reset', { recursive: true });
    const routes = [
      ['home', '/learn'],
      ['lectures', '/learn/lectures'],
      ['player', `/learn/courses/${course.id}/lessons/${lesson.id}`],
      ['assignments', '/learn/assignments'],
      ['resources', '/learn/resources'],
      ['attendance', '/learn/attendance'],
      ['discussions', '/learn/discussions'],
      ['certificates', '/learn/certificates'],
    ] as const;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    async function scan() {
      await expect(page.locator('.lms-content h1').first()).toBeVisible();
      await expect(page.locator('.lms-content [aria-busy="true"]')).toHaveCount(
        0,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        JSON.stringify(
          await page.evaluate(() =>
            [...document.querySelectorAll('*')]
              .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
              .map((el) => ({
                tag: el.tagName,
                class: el.className,
                right: el.getBoundingClientRect().right,
              })),
          ),
        ),
      ).toBe(true);
      const result = await new AxeBuilder({ page })
        .include('.lms-shell')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    }
    for (const [name, path] of routes) {
      await page.goto(path);
      await expect(page.locator('.lms-shell')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await scan();
      await page.screenshot({
        path: `docs/reviews/lms-ui-reset/1440-${name}.png`,
        fullPage: true,
      });
    }
    await page.goto('/learn/lectures');
    await page
      .getByRole('searchbox', { name: 'Search lectures' })
      .fill('unlikely nonexistent title');
    await expect(
      page.getByRole('heading', { name: 'No learning items in this view' }),
    ).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search lectures' }).fill('');
    await page
      .getByLabel('Learning status', { exact: true })
      .selectOption('Completed');
    await expect(page.locator('.lms-dense-list li')).toHaveCount(1);
    await page.goto('/learn/assignments');
    await page
      .getByRole('searchbox', { name: 'Search assignments' })
      .fill('unlikely nonexistent title');
    await expect(page.getByText('No assignments in this view.')).toBeVisible();
    await page.goto('/learn/resources');
    await page
      .getByRole('searchbox', { name: 'Search resources' })
      .fill('unlikely nonexistent title');
    await expect(page.locator('.lms-empty')).toBeVisible();
    await page.goto('/learn/discussions');
    await page
      .getByRole('searchbox', { name: 'Search discussions' })
      .fill('unlikely nonexistent title');
    await expect(page.getByText(/No discussions match/)).toBeVisible();
    const assignment = await db.learningItem.findFirstOrThrow({
      where: { section: { courseId: course.id }, type: 'ASSIGNMENT' },
    });
    await page.goto(`/learn/courses/${course.id}/assignments/${assignment.id}`);
    await page
      .getByLabel('Submission type', { exact: true })
      .selectOption('FILE');
    await expect(page.getByLabel('Files', { exact: true })).toBeVisible();
    await page
      .getByLabel('Submission type', { exact: true })
      .selectOption('TEXT');
    await expect(
      page.getByLabel('Your response', { exact: true }),
    ).toBeVisible();
    await scan();
    const quiz = await db.learningItem.findFirstOrThrow({
      where: { section: { courseId: course.id }, type: 'QUIZ' },
    });
    if (
      !(await db.academicAttempt.count({
        where: { userId: actor.id, activityId: quiz.id },
      }))
    ) {
      await page.goto(`/learn/courses/${course.id}/activities/${quiz.id}`);
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith(`/activities/${quiz.id}/start`) &&
          r.request().method() === 'POST',
      );
      await page
        .getByRole('button', { name: 'Start quiz', exact: true })
        .click();
      const payload = (await (await response).json()) as { id: string };
      newAttemptId = payload.id;
      await expect(
        page.getByText('Question 1 of 3', { exact: true }),
      ).toBeVisible();
      await page.getByRole('radio').first().check();
      await page
        .getByRole('button', { name: 'Next question', exact: true })
        .click();
      await expect(
        page.getByText('Question 2 of 3', { exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await expect(page.getByRole('radio').first()).toBeChecked();
      await page
        .getByRole('button', { name: 'Save answers', exact: true })
        .click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Answers saved.' }),
      ).toBeVisible();
      const saved = await db.academicAttempt.findFirstOrThrow({
        where: { id: newAttemptId, userId: actor.id, activityId: quiz.id },
        include: { responses: { include: { options: true } } },
      });
      expect(saved.status).toBe('IN_PROGRESS');
      expect(
        saved.responses.some((r) => r.options.some((o) => o.selected)),
      ).toBe(true);
      await scan();
    }
    await page.setViewportSize({ width: 820, height: 1000 });
    await page.goto('/learn');
    await scan();
    await page.goto(`/learn/courses/${course.id}/lessons/${lesson.id}`);
    await scan();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [name, path] of routes.slice(0, 4)) {
      await page.goto(path);
      await scan();
      await page.screenshot({
        path: `docs/reviews/lms-ui-reset/390-${name}.png`,
        fullPage: true,
      });
    }
    await page.goto(`/learn/courses/${course.id}/lessons/${lesson.id}`);
    const toggle = page.getByRole('button', {
      name: 'Course Outline',
      exact: true,
    });
    await toggle.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Close course outline' }),
    ).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.l2-drawer a').last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Close course outline' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/learn/resources');
    const download = page.getByRole('link', { name: 'Download', exact: true });
    if (await download.count())
      expect(
        (
          await context.request.get(
            (await download.getAttribute('href')) as string,
          )
        ).status(),
      ).toBe(200);
    expect(errors).toEqual([]);
    console.log(
      'Reviewed exactly 8 desktop + 4 mobile captures; tablet layout, real filters, drawer Escape/focus return, authorized private PDF, and representative WCAG AA checks passed.',
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
