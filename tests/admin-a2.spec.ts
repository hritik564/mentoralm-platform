import { refreshTestSession } from './helpers/clerk-session';
import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { testDatabaseUrl } from './helpers/d4-database';
import { studentSnapshot } from '../scripts/admin-owner/snapshot';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
loadEnvConfig(process.cwd(), true);
test('A2 authoring requires authentication and approved host', async ({
  page,
  request,
}) => {
  await page.goto('/admin/courses');
  await expect(page).toHaveURL(/admin-auth\/sign-in/);
  expect((await request.get('/api/admin/academic/courses')).status()).toBe(401);
  expect(
    (
      await request.get('/api/admin/academic/banks', {
        headers: { host: 'attacker.test' },
      })
    ).status(),
  ).toBe(400);
});
test('Real owner A2 authoring, draft/publish gates, responsive editors, keyboard and private boundaries', async ({
  page,
  context,
}) => {
  const db = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: testDatabaseUrl()! },
        { schema: process.env.D4_TEST_SCHEMA! },
      ),
    }),
    clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }),
    suffix = randomUUID().slice(0, 8),
    prefix = `A2 Review ${suffix}`,
    fixtureTargets: string[] = [];
  let sessionId: string | undefined,
    tokenId: string | undefined,
    courseId: string | undefined,
    programId: string | undefined,
    bankId: string | undefined,
    batchId: string | undefined;
  try {
    if (!/^d4_[a-f0-9]{24}$/.test(process.env.D4_TEST_SCHEMA || ''))
      throw Error('Isolated Test schema required');
    await mkdir('docs/reviews/admin-a2', { recursive: true });
    const users = (
      await clerk.users.getUserList({
        emailAddress: ['arcaderobo3@gmail.com'],
        limit: 2,
      })
    ).data;
    expect(users).toHaveLength(1);
    const owner = await db.user.findUniqueOrThrow({
        where: { clerkUserId: users[0].id },
      }),
      before = await studentSnapshot(db, owner.id);
    await page.goto('/admin-auth/sign-in');
    await page.waitForFunction(
      () =>
        !!(window as unknown as { Clerk?: { loaded: boolean } }).Clerk?.loaded,
    );
    const token = await clerk.signInTokens.createSignInToken({
      userId: users[0].id,
      expiresInSeconds: 180,
    });
    tokenId = token.id;
    sessionId = await page.evaluate(async (ticket) => {
      const c = (
        window as unknown as {
          Clerk: {
            client: {
              signIn: {
                create: (p: {
                  strategy: string;
                  ticket: string;
                }) => Promise<{ createdSessionId: string }>;
              };
            };
            setActive: (p: { session: string }) => Promise<void>;
          };
        }
      ).Clerk;
      const s = await c.client.signIn.create({ strategy: 'ticket', ticket });
      await c.setActive({ session: s.createdSessionId });
      return s.createdSessionId;
    }, token.token);
    async function post(path: string, body: unknown) {
      const r = await page.request.post(`/api/admin/${path}`, {
        data: body,
        headers: { origin: 'http://127.0.0.1:3100' },
      });
      expect(r.status(), `${path}: ${await r.text()}`).toBe(200);
      return (await r.json()) as { ref: string };
    }
    async function get<T>(path: string) {
      const r = await page.request.get(`/api/admin/${path}`);
      expect(r.status()).toBe(200);
      return (await r.json()) as T;
    }
    async function screenshot(name: string, axe = false) {
      await page.waitForTimeout(150);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .locator('dialog[open]')
          .evaluateAll((ds) =>
            ds.every((d) => d.scrollWidth <= d.clientWidth + 1),
          ),
      ).toBe(true);
      if (axe)
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
      await page.screenshot({ path: `docs/reviews/admin-a2/${name}.png` });
    }
    async function close() {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    // Create real temporary academic fixtures through the authorized UI/API; no new identity or owner Enrollment.
    await page.goto('/admin/courses');
    await expect(
      page.getByRole('heading', { name: 'Programs & Courses' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Programs', exact: true }).click();
    await page
      .getByRole('button', { name: 'Create Program', exact: true })
      .click();
    await page.getByLabel('Title', { exact: true }).fill(`${prefix} Program`);
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    programId = (
      await db.program.findFirstOrThrow({
        where: { title: `${prefix} Program` },
      })
    ).id;
    fixtureTargets.push(programId);
    await page.getByRole('button', { name: 'Courses', exact: true }).click();
    await page
      .getByRole('button', { name: 'Create Course', exact: true })
      .click();
    await page
      .getByLabel('Course title', { exact: true })
      .fill(`${prefix} Course`);
    await page
      .getByLabel('Description', { exact: true })
      .fill('Practice authoring with temporary review content.');
    await page
      .getByRole('combobox', { name: 'Program', exact: true })
      .selectOption({ label: `${prefix} Program` });
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: `${prefix} Course`, exact: true }),
    ).toBeVisible();
    const courseRef = new URL(page.url()).pathname.split('/').at(-1)!;
    courseId = (
      await db.course.findFirstOrThrow({ where: { title: `${prefix} Course` } })
    ).id;
    fixtureTargets.push(courseId);
    await page
      .getByRole('button', { name: 'Add Section', exact: true })
      .click();
    await page.getByLabel('Title', { exact: true }).fill('Foundations');
    await page
      .getByLabel('Section description')
      .fill('Build understanding before practice.');
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const builder = await get<{ sections: { ref: string }[] }>(
      `academic/courses/${courseRef}`,
    );
    const sectionRef = builder.sections[0].ref;
    async function addItem(title: string, type: string) {
      await page
        .getByRole('button', { name: 'Add learning item', exact: true })
        .click();
      await page.getByLabel('Title', { exact: true }).fill(title);
      await page.getByLabel('Learning item type').selectOption(type);
      await page
        .getByRole('button', { name: 'Save changes', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const data = await get<{
        sections: { items: { ref: string; title: string }[] }[];
      }>(`academic/courses/${courseRef}`);
      return data.sections[0].items.find((i) => i.title === title)!.ref;
    }
    const lessonRef = await addItem('Welcome to AI', 'LESSON');
    await page
      .getByRole('button', { name: 'Welcome to AI', exact: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'LESSON editor' }),
    ).toBeVisible();
    await page
      .getByLabel('Block 1 text', { exact: true })
      .fill('Learn, practice and reflect with MentoraLM.');
    await page
      .locator('.academic-editor-panel')
      .getByRole('button', { name: 'Save changes', exact: true })
      .first()
      .click();
    await expect(
      page.getByText('Changes saved.', { exact: true }),
    ).toBeVisible();
    await screenshot('1440-lesson-editor-light', true);
    await close();
    const itemBase = (ref: string) =>
      `academic/courses/${courseRef}/sections/${sectionRef}/items/${ref}`;
    const quizRef = await addItem('Foundations Quiz', 'QUIZ'),
      assignmentRef = await addItem('Prompt Assignment', 'ASSIGNMENT'),
      liveRef = await addItem('Live AI Workshop', 'LIVE_SESSION'),
      assessmentRef = await addItem('AI Skills Assessment', 'ASSESSMENT');
    const bank = await post('academic/banks', { title: `${prefix} Bank` });
    bankId = (
      await db.questionBank.findFirstOrThrow({
        where: { title: `${prefix} Bank` },
      })
    ).id;
    fixtureTargets.push(bankId);
    const question = await post(`academic/banks/${bank.ref}/questions`, {
      type: 'SINGLE_CHOICE',
      prompt: 'Which practice supports clear prompts?',
      explanation: 'State a clear goal.',
      published: true,
      options: [
        { label: 'State a clear goal', correct: true },
        { label: 'Omit all context', correct: false },
      ],
    });
    const questionId = (
      await db.question.findFirstOrThrow({ where: { bankId } })
    ).id;
    fixtureTargets.push(questionId);
    await post(`${itemBase(quizRef)}/activity`, {
      instructions: 'Choose the clearest answer.',
      passingPercent: 70,
      attemptLimit: 3,
      reviewAnswers: false,
      questions: [{ questionId: question.ref, points: 1 }],
    });
    await post(`${itemBase(assessmentRef)}/activity`, {
      instructions: 'Academic assessment of AI foundations.',
      passingPercent: null,
      attemptLimit: 3,
      reviewAnswers: false,
      questions: [{ questionId: question.ref, points: 1 }],
    });
    await post(`${itemBase(assignmentRef)}/assignment`, {
      instructions: 'Write a prompt with a clear goal and context.',
      dueAt: null,
      allowedKinds: ['TEXT', 'FILE'],
      maxFiles: 2,
      maxFileBytes: 5242880,
      requiresAcceptance: true,
      allowResubmission: true,
    });
    batchId = (
      await db.batch.create({
        data: {
          code: `A2-${suffix.toUpperCase()}`,
          name: `${prefix} Batch`,
          courseId,
        },
      })
    ).id;
    fixtureTargets.push(batchId);
    // Acquire the Batch's opaque reference through the existing A1 boundary.
    const batches = await get<{ rows: { ref: string; name: string }[] }>(
        `batches?q=${encodeURIComponent(prefix)}`,
      ),
      batchRef = batches.rows.find((b) => b.name === `${prefix} Batch`)!.ref;
    await post(`${itemBase(liveRef)}/occurrences`, {
      batchRef,
      title: 'Live AI Workshop — First session',
      startsAt: '2026-10-10T10:00:00Z',
      endsAt: '2026-10-10T11:00:00Z',
      status: 'SCHEDULED',
      instructorId: null,
      externalTargetId: null,
      locationLabel: 'Online',
    });
    await post(`${itemBase(liveRef)}/occurrences`, {
      batchRef,
      title: 'Live AI Workshop — Follow-up',
      startsAt: '2026-10-11T10:00:00Z',
      endsAt: '2026-10-11T11:00:00Z',
      status: 'SCHEDULED',
      instructorId: null,
      externalTargetId: null,
      locationLabel: 'Online',
    });
    fixtureTargets.push(
      ...(
        await db.batchSession.findMany({
          where: { batchId },
          select: { id: true },
        })
      ).map((s) => s.id),
    );
    const rawSections = await db.section.findMany({
      where: { courseId },
      include: { items: { select: { id: true } } },
    });
    fixtureTargets.push(
      ...rawSections.flatMap((s) => [s.id, ...s.items.map((i) => i.id)]),
    );
    // Required views and both themes using existing real owner authentication.
    for (const theme of ['light', 'dark']) {
      await context.addCookies([
        {
          name: 'mentoralm-product-theme',
          value: theme,
          url: 'http://127.0.0.1:3100',
        },
      ]);
      await refreshTestSession(page);
      await page.goto(`/admin/courses/${courseRef}`);
      await expect(
        page.getByRole('button', { name: 'Welcome to AI', exact: true }),
      ).toBeVisible();
      await expect(page.locator('.admin-shell')).toHaveAttribute(
        'data-admin-theme',
        theme,
      );
      await screenshot(`1440-course-builder-${theme}`, true);
      await page
        .getByRole('button', { name: 'Foundations Quiz', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: 'Quiz configuration', exact: true }),
      ).toBeVisible();
      await screenshot(`1440-quiz-editor-${theme}`, true);
      await close();
      await page
        .getByRole('button', { name: 'Prompt Assignment', exact: true })
        .click();
      await expect(
        page.getByRole('heading', {
          name: 'Assignment configuration',
          exact: true,
        }),
      ).toBeVisible();
      await screenshot(`1440-assignment-editor-${theme}`, true);
      await close();
      await page
        .getByRole('button', { name: 'Live AI Workshop', exact: true })
        .click();
      await expect(
        page.getByText('Live AI Workshop — First session', { exact: true }),
      ).toBeVisible();
      await screenshot(`1440-live-session-academic-${theme}`, true);
      await close();
      await refreshTestSession(page);
      await page.goto(`/admin/question-banks/${bank.ref}`);
      await expect(
        page.getByText('Which practice supports clear prompts?', {
          exact: true,
        }),
      ).toBeVisible();
      await screenshot(`1440-question-bank-${theme}`, true);
      await page
        .getByRole('button', { name: 'Edit question', exact: true })
        .click();
      await screenshot(`1440-question-editor-${theme}`, true);
      await close();
      await page.goto('/admin/courses');
      await expect(
        page.getByRole('link', { name: `${prefix} Course`, exact: true }),
      ).toBeVisible();
      await screenshot(`1440-programs-courses-${theme}`, true);
    }
    // Publish the real configured hierarchy through UI; no Enrollment gets created by publishing.
    await refreshTestSession(page);
    await page.goto(`/admin/courses/${courseRef}`);
    await page
      .getByRole('button', { name: 'Welcome to AI', exact: true })
      .click();
    await page.getByLabel('Published', { exact: true }).check();
    await page
      .locator('.academic-item-settings')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(
      page
        .locator('.academic-item-settings')
        .getByText('Changes saved.', { exact: true }),
    ).toBeVisible();
    await close();
    await page
      .getByRole('button', { name: 'Publish Section', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Unpublish Section', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Publish Course', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Unpublish Course', exact: true }),
    ).toBeVisible();
    expect(await db.enrollment.count({ where: { courseId } })).toBe(0);
    // Browser request security: tampering, wrong parent/typed handle, body limits, origin and client claims.
    expect(
      (
        await page.request.post(`/api/admin/${itemBase(lessonRef)}/lesson`, {
          data: {
            format: 'TEXT',
            structuredContent: '<iframe>',
            durationSeconds: null,
          },
          headers: { origin: 'http://127.0.0.1:3100' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.post(`/api/admin/${itemBase(lessonRef)}/lesson`, {
          data: { actorId: owner.id },
          headers: { origin: 'https://attacker.test' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post('/api/admin/academic/programs', {
          data: { title: 'x', role: 'ADMIN' },
          headers: { origin: 'http://127.0.0.1:3100' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.post('/api/admin/academic/programs', {
          data: { title: 'x'.repeat(17000) },
          headers: { origin: 'http://127.0.0.1:3100' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.get(`/api/admin/academic/courses/${bank.ref}`)
      ).status(),
    ).toBe(404);
    for (const width of [1024, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await refreshTestSession(page);
      await page.goto(`/admin/courses/${courseRef}`);
      await expect(
        page.getByRole('button', { name: 'Welcome to AI', exact: true }),
      ).toBeVisible();
      await screenshot(`${width}-course-builder-dark`, width === 820);
      await page
        .getByRole('button', { name: 'Welcome to AI', exact: true })
        .click();
      await expect(
        page.getByLabel('Block 1 text', { exact: true }),
      ).toBeVisible();
      await screenshot(`${width}-lesson-editor-dark`, width === 820);
      const dialog = page.getByRole('dialog');
      await dialog
        .getByRole('button', { name: 'Close dialog', exact: true })
        .focus();
      await page.keyboard.press('Shift+Tab');
      expect(
        await dialog.evaluate((d) => d.contains(document.activeElement)),
      ).toBe(true);
      await close();
      await expect(
        page.getByRole('button', { name: 'Welcome to AI', exact: true }),
      ).toBeFocused();
    }
    const after = await studentSnapshot(db, owner.id);
    expect(after).toEqual(before);
    await writeFile(
      'docs/reviews/admin-a2/owner-student-preservation.json',
      JSON.stringify({ before, after, unchanged: true }, null, 2),
    );
  } finally {
    // Immutable audit and all business fixtures are removed only by isolated-schema teardown.
    if (sessionId)
      await clerk.sessions.revokeSession(sessionId).catch(() => {});
    if (tokenId)
      await clerk.signInTokens.revokeSignInToken(tokenId).catch(() => {});
    await db.$disconnect();
  }
});
