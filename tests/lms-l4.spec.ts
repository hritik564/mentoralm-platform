import { test, expect, type Page } from '@playwright/test';
import {
  clerk,
  clerkSetup,
  setupClerkTestingToken,
} from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/nextjs/server';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { testDatabaseUrl } from './helpers/d4-database';
import { academicFixture } from './helpers/l3-fixtures';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AxeBuilder from '@axe-core/playwright';
async function scan(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .include('.lms-shell')
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
  if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'))
    throw Error('Clerk Development required');
  await clerkSetup();
});
test('academic routes and files require authentication', async ({
  request,
}) => {
  for (const kind of ['activities', 'assignments'])
    expect(
      (
        await request.get(`/learn/courses/unknown/${kind}/unknown`, {
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(307);
  expect((await request.get('/api/lms/discussions')).status()).toBe(401);
  expect(
    (
      await request.get('/dashboard', {
        headers: { Host: 'evil.test' },
        maxRedirects: 0,
      })
    ).status(),
  ).toBe(400);
  expect((await request.get('/api/lms/academic/attendance')).status()).toBe(
    401,
  );
  expect(
    (
      await request.get('/api/lms/academic/certificates/unknown/download')
    ).status(),
  ).toBe(401);
});
test('populated academic workflow, scoring, assignment history, attendance, completion and certificate projection', async ({
  page,
}, info) => {
  const schema = process.env.D4_TEST_SCHEMA;
  if (!schema || !/^d4_[a-f0-9]{24}$/.test(schema))
    throw Error('Isolated schema required');
  const db = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: testDatabaseUrl()! },
        { schema },
      ),
    }),
    client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! }),
    users: string[] = [];
  const review = 'docs/reviews/l4';
  await mkdir(review, { recursive: true });
  async function capture(kind: string) {
    if (
      info.project.name === 'l4-mobile' &&
      !['home', 'player', 'discussions'].includes(kind)
    )
      return;
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.screenshot({
      path: `${review}/${info.project.name}-${kind}.png`,
      fullPage: true,
    });
  }
  async function account() {
    const email = `l4-${randomBytes(8).toString('hex')}+clerk_test@example.com`,
      user = await client.users.createUser({
        emailAddress: [email],
        firstName: 'Academic student',
        skipPasswordRequirement: true,
      });
    users.push(user.id);
    return { email, user };
  }
  function privileged(payload: unknown) {
    execFileSync(
      process.execPath,
      [
        'node_modules/tsx/dist/cli.mjs',
        'tests/helpers/l3-staff.ts',
        JSON.stringify(payload),
      ],
      {
        env: { ...process.env, NODE_OPTIONS: '--conditions=react-server' },
        stdio: 'pipe',
      },
    );
  }
  try {
    const A = await account(),
      B = await account();
    await setupClerkTestingToken({ page });
    await page.goto('/sign-in');
    await clerk.signIn({ page, emailAddress: A.email });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
    const student = await db.user.findUniqueOrThrow({
      where: { clerkUserId: A.user.id },
    });
    await db.user.update({
      where: { id: student.id },
      data: { lmsAccessOverride: 'ENABLED' },
    });
    const f = await academicFixture(db, student.id, info.project.name),
      instructor = await db.user.create({
        data: {
          clerkUserId: `fixture-${info.project.name}`,
          role: 'INSTRUCTOR',
        },
      });
    await db.batchInstructor.create({
      data: { batchId: f.batch.id, instructorId: instructor.id },
    });
    const coursePath = `/learn/courses/${f.course.id}`,
      quizPath = `${coursePath}/activities/${f.quiz.id}`,
      assignPath = `${coursePath}/assignments/${f.assignment.id}`,
      api = `/api/lms/academic/courses/${f.course.id}`;
    await page.goto('/dashboard/courses');
    await expect(
      page.getByRole('link', { name: `Open LMS: ${f.course.title}` }),
    ).toHaveAttribute('href', `${coursePath}/lessons/${f.lesson.id}`);
    await page
      .getByRole('link', { name: `Open LMS: ${f.course.title}` })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Learning foundation', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Mark Complete' }).click();
    await expect(page.locator('.l2-progress')).toContainText('25%');
    await scan(page);
    await capture('player');
    await expect(
      page.getByRole('link', { name: /Next learning item: Foundations quiz/ }),
    ).toHaveAttribute('href', quizPath);
    await page.goto('/dashboard/courses');
    await expect(
      page.getByRole('link', { name: `Continue Learning: ${f.course.title}` }),
    ).toHaveAttribute('href', quizPath);
    await page
      .getByRole('link', { name: `Continue Learning: ${f.course.title}` })
      .click();
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    await expect(page.getByText('Attempt 1 · In progress')).toBeVisible();
    expect(
      await page.evaluate(() => Object.hasOwn(window, '__questionXss')),
    ).toBe(false);
    await page.getByRole('button', { name: 'Submit attempt' }).click();
    await expect(page.locator('.l3-attempt').getByRole('alert')).toContainText(
      'Answer questions 1, 2, 3',
    );
    await expect(page.locator('.l3-attempt').getByRole('alert')).toBeFocused();
    const payload = await (
      await page.context().request.get(`${api}/activities/${f.quiz.id}`)
    ).json();
    expect(JSON.stringify(payload)).not.toMatch(
      /"correct"|"explanation"|"awardedPoints"/,
    );
    await scan(page);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.getByLabel('Vague', { exact: true }).check();
    await page.getByLabel('Interrupt', { exact: true }).check();
    await page.getByLabel('False', { exact: true }).check();
    await page.getByRole('button', { name: 'Save answers' }).click();
    await expect(page.getByRole('status')).toContainText('Answers saved');
    await page.goto('/dashboard/courses');
    await expect(
      page.getByRole('link', { name: `Continue Learning: ${f.course.title}` }),
    ).toHaveAttribute('href', quizPath);
    await page
      .getByRole('link', { name: `Continue Learning: ${f.course.title}` })
      .click();
    await expect(page.getByLabel('Vague', { exact: true })).toBeChecked();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Submit attempt' }).click();
    await expect(
      page.getByRole('heading', { name: 'Attempt result' }),
    ).toBeVisible();
    await expect(page.locator('.l3-result')).toContainText('0/6 points');
    await expect(page.locator('.l3-result')).toContainText('Not passed');
    await page.getByRole('button', { name: 'Start another attempt' }).click();
    await expect(page.getByText('Attempt 2 · In progress')).toBeVisible();
    await page.getByLabel('Clear', { exact: true }).check();
    await page.getByLabel('Listen', { exact: true }).check();
    await page.getByLabel('Clarify', { exact: true }).check();
    await page.getByLabel('True', { exact: true }).check();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Submit attempt' }).click();
    await expect(page.locator('.l3-result')).toContainText('6/6 points');
    await expect(page.locator('.l3-result')).toContainText('Passed');
    await expect(page.locator('.l2-progress')).toContainText('50%');
    await scan(page);
    if (info.project.name === 'l4-desktop') {
      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur();
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
    }
    await page.goto('/learn/assignments');
    await expect(
      page.getByRole('heading', { name: 'Practice assignment' }),
    ).toBeVisible();
    await scan(page);
    if (info.project.name === 'l4-desktop') {
      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur();
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
    }
    await capture('assignments');
    await page.goto(assignPath);
    await page.getByLabel('Submission type').selectOption('TEXT_AND_FILE');
    await page.getByLabel('Your response').fill('Original work');
    await page.getByLabel('Files', { exact: true }).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Private student notes'),
    });
    await page
      .getByRole('button', { name: 'Submit assignment', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Submission saved');
    await expect(
      page.getByRole('heading', { name: /Version 1/ }),
    ).toBeVisible();
    let submission = await db.assignmentSubmission.findUniqueOrThrow({
      where: {
        userId_assignmentId: {
          userId: student.id,
          assignmentId: f.assignment.id,
        },
      },
      include: {
        versions: { orderBy: { number: 'desc' }, include: { files: true } },
      },
    });
    const first = submission.versions[0];
    privileged({
      actorId: instructor.id,
      versionId: first.id,
      status: 'CHANGES_REQUESTED',
      feedback: 'Please refine your answer.',
      batchId: f.batch.id,
    });
    await page.reload();
    await expect(page.getByText('Please refine your answer.')).toBeVisible();
    await page.getByLabel('Submission type').selectOption('TEXT');
    await page.getByLabel('Your response').fill('Refined work');
    await page.getByRole('button', { name: 'Submit new version' }).click();
    await expect(
      page.getByRole('heading', { name: /Version 2/ }),
    ).toBeVisible();
    submission = await db.assignmentSubmission.findUniqueOrThrow({
      where: { id: submission.id },
      include: {
        versions: { orderBy: { number: 'desc' }, include: { files: true } },
      },
    });
    expect(submission.versions[1].text).toBe('Original work');
    privileged({
      actorId: instructor.id,
      versionId: submission.versions[0].id,
      status: 'ACCEPTED',
      feedback: 'Accepted after review.',
      batchId: f.batch.id,
    });
    await page.reload();
    await expect(page.getByText('Accepted after review.')).toBeVisible();
    await expect(page.getByLabel('Your response')).toHaveCount(0);
    await scan(page);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    const req = page.context().request,
      origin = { Origin: 'http://127.0.0.1:3100' };
    for (const extra of [
      { userId: 'other' },
      { status: 'ACCEPTED' },
      { reviewerId: instructor.id },
      { score: 100 },
    ])
      expect(
        (
          await req.post(`${api}/assignments/${f.assignment.id}/submit`, {
            headers: origin,
            data: {
              requestKey: crypto.randomUUID(),
              kind: 'TEXT',
              text: 'tamper',
              ...extra,
            },
          })
        ).status(),
      ).toBe(400);
    const ownQuiz = (
      await (await req.get(`${api}/activities/${f.quiz.id}`)).json()
    ).attempts[0];
    expect(
      (
        await req.post(
          `${api}/activities/${f.quiz.id}/attempts/${ownQuiz.id}/submit`,
          { headers: origin, data: { score: 100 } },
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await req.post('/api/lms/academic/attendance', {
          headers: origin,
          data: { status: 'PRESENT' },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await req.post('/api/lms/academic/certificates/issue', {
          headers: origin,
          data: { courseId: f.course.id },
        })
      ).status(),
    ).toBe(404);
    privileged({
      actorId: instructor.id,
      sessionId: f.session.id,
      membershipId: f.membership.id,
      batchId: f.batch.id,
    });
    await page.goto('/learn/attendance');
    await expect(
      page.getByRole('heading', { name: 'Practice session' }),
    ).toBeVisible();
    await expect(page.getByText('present', { exact: true })).toBeVisible();
    await scan(page);
    if (info.project.name === 'l4-desktop') {
      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur();
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
    }
    await page.goto(`${coursePath}/activities/${f.assessment.id}`);
    await page
      .getByRole('button', { name: 'Start assessment', exact: true })
      .click();
    await page.getByLabel('Clear', { exact: true }).check();
    await page.getByLabel('Your answer').nth(0).fill('My approach');
    await page.getByLabel('Your answer').nth(1).fill('My reasoning');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Submit attempt' }).click();
    await expect(page.locator('.l3-result')).toContainText(
      'Text answers require review',
    );
    await expect(page.locator('.l3-result')).toContainText(
      'No personal or career interpretation',
    );
    await page.goto(`${coursePath}/lessons/${f.lesson.id}`);

    await expect(
      page.getByRole('button', { name: '✓ Lesson completed' }),
    ).toBeVisible();
    await expect(page.locator('.l2-progress')).toContainText('100%');
    if (info.project.name === 'l4-desktop') {
      await scan(page);
      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur();
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      await page.setViewportSize({ width: 820, height: 1000 });
      await page.goto(quizPath);
      await scan(page);
      await expect(
        page.getByRole('button', { name: 'Course Outline', exact: true }),
      ).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.goto('/learn/lectures');
    await expect(
      page
        .locator('.l2-discovery')
        .getByRole('link', { name: /Foundations quiz/ }),
    ).toHaveAttribute('href', quizPath);
    const enrollment = await db.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: student.id, courseId: f.course.id } },
    });
    expect(enrollment.status).toBe('COMPLETED');
    const cert = await db.certificate.findUniqueOrThrow({
      where: { userId_courseId: { userId: student.id, courseId: f.course.id } },
    });
    await page.goto(`/learn/certificates/${cert.code}`);
    await expect(page.getByText(cert.code, { exact: true })).toBeVisible();
    await expect(
      page.getByText('A certificate document has not been attached yet.'),
    ).toBeVisible();
    const root = join(tmpdir(), `mentoralm-${schema}`);
    await writeFile(
      join(root, `${info.project.name}-certificate.pdf`),
      '%PDF-1.4\nprivate certificate fixture',
    );
    await db.certificate.update({
      where: { id: cert.id },
      data: {
        storageKey: `${info.project.name}-certificate.pdf`,
        fileName: 'certificate.pdf',
        mimeType: 'application/pdf',
      },
    });
    await page.reload();
    await expect(
      page.getByRole('link', { name: 'Download certificate PDF' }),
    ).toBeVisible();
    expect(
      (
        await req.get(`/api/lms/academic/certificates/${cert.code}/download`)
      ).status(),
    ).toBe(200);
    await scan(page);
    await capture('certificate');
    await page.goto('/dashboard/courses');
    await expect(
      page.getByRole('link', { name: `View certificate: ${f.course.title}` }),
    ).toBeVisible();
    await expect(page.locator('body')).not.toContainText(student.studentId!);
    await page.goto('/dashboard/resources');
    await expect(
      page.getByRole('heading', { name: `${f.course.title} certificate` }),
    ).toBeVisible();
    await page.goto('/learn');
    await expect(
      page.getByRole('heading', { name: 'Academic activity' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Certificates · 1' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Recent result' }),
    ).toBeVisible();
    await scan(page);
    await capture('home');
    await page.goto('/learn/discussions');
    await page.getByLabel('Audience', { exact: true }).selectOption(f.batch.id);
    await page
      .getByLabel('Title', { exact: true })
      .fill('How can we practice together?');
    await page
      .getByLabel('Your question or message')
      .fill('<script>window.__discussionXss=true</script> Learning question');
    await page.getByRole('button', { name: 'Create thread' }).click();
    await expect(
      page.getByRole('heading', { name: 'How can we practice together?' }),
    ).toBeVisible();
    const threadId = page.url().split('/').at(-1)!;
    await page
      .getByLabel('Your message', { exact: true })
      .fill('A follow-up learning question.');
    await page.getByRole('button', { name: 'Post reply' }).click();
    await expect(page.getByRole('status')).toContainText('Reply posted');
    await expect(page.getByRole('status')).toBeFocused();
    await expect(page.locator('.l4-conversation')).toContainText(
      'A follow-up learning question.',
    );
    expect(
      await page.evaluate(() => Object.hasOwn(window, '__discussionXss')),
    ).toBe(false);
    await scan(page);
    for (const input of [
      {
        courseId: f.course.id,
        title: 'Spoof author',
        body: 'x',
        authorId: 'other',
      },
      {
        courseId: f.course.id,
        title: 'Oversized body',
        body: 'x'.repeat(6001),
      },
      { courseId: f.course.id, title: 'Bad owner', body: 'x', role: 'ADMIN' },
    ])
      expect(
        (
          await req.post('/api/lms/discussions', {
            headers: origin,
            data: input,
          })
        ).status(),
      ).toBe(400);
    expect(
      (
        await req.post(`/api/lms/discussions/${threadId}/reply`, {
          headers: { Origin: 'https://evil.test' },
          data: { body: 'CSRF' },
        })
      ).status(),
    ).toBe(403);
    await page.goto('/learn/discussions');
    await scan(page);
    await capture('discussions');
    const widths = info.project.name === 'l4-desktop' ? [1440, 820] : [390];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of [
        '/learn',
        '/learn/lectures',
        coursePath,
        quizPath,
        assignPath,
        '/learn/assignments',
        '/learn/attendance',
        '/learn/resources',
        '/learn/discussions',
        `/learn/certificates/${cert.code}`,
      ]) {
        await page.goto(path);
        if (path === '/learn')
          await expect(
            page.getByRole('link', { name: 'How can we practice together?' }),
          ).toBeVisible();
        await scan(page);
      }
    }
    await clerk.signOut({ page });
    await page.goto('/sign-in');
    await clerk.signIn({ page, emailAddress: B.email });
    await page.goto('/dashboard');
    const other = await db.user.findUniqueOrThrow({
      where: { clerkUserId: B.user.id },
    });
    await db.user.update({
      where: { id: other.id },
      data: { lmsAccessOverride: 'ENABLED' },
    });
    await db.enrollment.create({
      data: { userId: other.id, courseId: f.course.id },
    });
    expect((await req.get(`/api/lms/discussions/${threadId}`)).status()).toBe(
      404,
    );
    await page.goto(`/learn/discussions/${threadId}`);
    await expect(
      page.getByRole('heading', { name: 'Discussion not available' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Contact Support' }),
    ).toHaveAttribute('href', '/dashboard/support');
    expect(
      (
        await req.post(`/api/lms/discussions/${threadId}/reply`, {
          headers: origin,
          data: { body: 'Cross batch' },
        })
      ).status(),
    ).toBe(404);
    expect(
      (await req.get(`/api/lms/academic/certificates/${cert.code}`)).status(),
    ).toBe(404);
    expect(
      (
        await req.get(
          `${api}/assignments/${f.assignment.id}/files/${first.files[0].id}?download=1`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await req.post(
          `${api}/activities/${f.quiz.id}/attempts/${ownQuiz.id}/submit`,
          { headers: origin, data: {} },
        )
      ).status(),
    ).toBe(404);
    expect(
      (await (await req.get(`${api}/activities/${f.quiz.id}`)).json()).attempts,
    ).toEqual([]);
    expect(
      (await (await req.get('/api/lms/academic/attendance')).json()).total,
    ).toBe(0);
    await db.user.update({
      where: { id: other.id },
      data: { lmsAccessOverride: 'DISABLED' },
    });
    expect(
      (
        await req.post(`${api}/activities/${f.quiz.id}/start`, {
          headers: origin,
          data: {},
        })
      ).status(),
    ).toBe(404);
    await page.goto(quizPath);
    await expect(
      page.getByRole('heading', { name: 'Learning access unavailable' }),
    ).toBeVisible();
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
    expect((await req.get('/api/student/profile')).status()).toBe(200);
    expect((await req.get('/api/lms/discussions')).status()).toBe(403);
    let limited = false;
    for (let i = 0; i < 25; i++) {
      const response = await req.post('/api/lms/discussions/missing/reply', {
        headers: origin,
        data: { body: 'Rate policy probe' },
      });
      expect([404, 429]).toContain(response.status());
      if (response.status() === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  } finally {
    await db.$disconnect();
    for (const id of users) await client.users.deleteUser(id);
  }
});
