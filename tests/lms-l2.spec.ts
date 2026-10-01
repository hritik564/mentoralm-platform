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
import { learningFixture } from './helpers/l2-fixtures';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
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
function pdfFixture() {
  const stream = 'BT /F1 18 Tf 40 720 Td (MentoraLM learning worksheet) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let result = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(result.length);
    result += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = result.length;
  result +=
    'xref\n0 6\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
      .join('') +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return result;
}
test.beforeAll(async () => {
  if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'))
    throw Error('Clerk Development required');
  await clerkSetup();
});
test('protected lesson navigation and media require authentication', async ({
  request,
}) => {
  for (const path of [
    '/learn/courses/unknown/lessons/unknown',
    '/courses/unknown/lessons/unknown',
  ]) {
    expect(
      (
        await request.get(path, {
          headers: { Host: 'students.mentoralm.com' },
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(307);
  }
  expect(
    (
      await request.get('/api/lms/courses/unknown/lessons/unknown/media')
    ).status(),
  ).toBe(401);
});
test('real course player, formats, persistence, responsive outline, Dashboard projection and revoked access', async ({
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
  const root = join(tmpdir(), `mentoralm-${schema}`),
    review = 'docs/reviews/l2';
  await mkdir(review, { recursive: true });
  async function account() {
    const email = `l2-${randomBytes(8).toString('hex')}+clerk_test@example.com`;
    const user = await client.users.createUser({
      emailAddress: [email],
      firstName: 'Learning student',
      skipPasswordRequirement: true,
    });
    users.push(user.id);
    return { user, email };
  }
  try {
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d')!;
      const stream = canvas.captureStream(10),
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }),
        chunks: Blob[] = [];
      const blob = await new Promise<Blob>((resolve) => {
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: 'video/webm' }));
        recorder.start();
        let frame = 0;
        const timer = setInterval(() => {
          ctx.fillStyle = '#172540';
          ctx.fillRect(0, 0, 320, 180);
          ctx.fillStyle = '#ffffff';
          ctx.font = '20px sans-serif';
          ctx.fillText(`Learning practice ${++frame}`, 24, 90);
        }, 50);
        setTimeout(() => {
          clearInterval(timer);
          recorder.stop();
          stream.getTracks().forEach((t) => t.stop());
        }, 650);
      });
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await writeFile(join(root, 'lesson.webm'), Buffer.from(bytes));
    await writeFile(join(root, 'lesson.pdf'), pdfFixture());
    await copyFile('public/favicon.png', join(root, 'lesson.png'));
    await writeFile(
      join(root, 'captions.vtt'),
      'WEBVTT\n\n00:00.000 --> 00:01.000\nLearning practice.\n',
    );
    const A = await account(),
      B = await account();
    await setupClerkTestingToken({ page });
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: A.email });
    await page.goto('/learn');
    await expect(
      page.getByRole('heading', { name: 'Learning access unavailable' }),
    ).toBeVisible();
    const student = await db.user.findUniqueOrThrow({
      where: { clerkUserId: A.user.id },
    });
    await db.user.update({
      where: { id: student.id },
      data: { lmsAccessOverride: 'ENABLED' },
    });
    const f = await learningFixture(db, student.id, info.project.name);
    const lessonPath = (id: string) =>
        `/learn/courses/${f.course.id}/lessons/${id}`,
      api = (id: string, action: string) =>
        `/api/lms/courses/${f.course.id}/lessons/${id}/${action}`;
    await page.goto(lessonPath(f.first.id));
    await expect(
      page
        .locator('.l2-content')
        .getByRole('heading', { name: 'Speaking with clarity', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('A clear message starts with a clear purpose.'),
    ).toBeVisible();
    expect(
      await page.evaluate(() => Object.hasOwn(window, '__lessonXss')),
    ).toBe(false);
    await expect(page.locator('body')).not.toContainText('PRIVATE DRAFT');
    await expect
      .poll(() =>
        db.lessonState.count({
          where: { userId: student.id, itemId: f.first.id },
        }),
      )
      .toBe(1);
    await scan(page);
    await page.screenshot({
      path: `${review}/${info.project.name}-player.png`,
      fullPage: true,
    });
    if (info.project.name === 'l2-mobile') {
      await page
        .getByRole('button', { name: 'Course Outline', exact: true })
        .click();
      const dialog = page.getByRole('dialog', { name: 'Course Outline' });
      await expect(dialog).toBeVisible();
      await page.screenshot({
        path: `${review}/l2-mobile-outline.png`,
        fullPage: true,
      });
      await page.keyboard.press('Shift+Tab');
      expect(
        await page.evaluate(
          () => document.activeElement?.closest('dialog') !== null,
        ),
      ).toBe(true);
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Course Outline', exact: true }),
      ).toBeFocused();
      await page
        .getByRole('button', { name: 'Course Outline', exact: true })
        .click();
      await page
        .getByRole('dialog')
        .getByRole('link', { name: /Listening with purpose/ })
        .click();
      await expect(
        page
          .locator('.l2-content')
          .getByRole('heading', { name: 'Listening with purpose' }),
      ).toBeVisible();
      await page.goto(lessonPath(f.first.id));
    }
    await page
      .getByRole('button', { name: 'Mark Complete', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: '✓ Lesson completed' }),
    ).toBeDisabled();
    await expect(page.locator('.l2-progress')).toContainText('25%');
    await page.getByRole('link', { name: 'Next →', exact: true }).click();
    await expect(
      page
        .locator('.l2-content')
        .getByRole('heading', { name: 'Listening with purpose' }),
    ).toBeVisible();
    await expect
      .poll(() =>
        db.lessonState.count({
          where: { userId: student.id, itemId: f.next.id },
        }),
      )
      .toBe(1);
    await page.goto('/dashboard');
    await expect(page.locator('.d2-learning')).toContainText('25%');
    await expect(page.locator('.d2-learning')).toContainText(
      'Listening with purpose',
    );
    await expect(page.locator('body')).not.toContainText(student.studentId!);
    await page
      .locator('.d2-learning')
      .getByRole('link', {
        name: new RegExp(`Continue Learning: ${f.course.title}`),
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${f.next.id}$`));
    await page.goto('/learn/lectures');
    await expect(
      page.getByText('Self-paced lessons in your enrolled courses.'),
    ).toBeVisible();
    await scan(page);
    if (info.project.name === 'l2-desktop')
      await page.screenshot({
        path: `${review}/l2-desktop-lectures.png`,
        fullPage: true,
      });
    await page.goto('/learn');
    await expect(
      page.getByRole('heading', { name: 'Continue Learning', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.l2-course-list')).toContainText('25%');
    await scan(page);
    await page.screenshot({
      path: `${review}/${info.project.name}-home.png`,
      fullPage: true,
    });
    await page.goto(lessonPath(f.video.id));
    const video = page.locator('video');
    await expect(video).toHaveAttribute('controls', '');
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThanOrEqual(2);
    await expect(video.locator('track')).toHaveCount(1);
    await scan(page);
    await page.goto(lessonPath(f.pdf.id));
    await expect(
      page.getByRole('link', { name: /Open PDF in a new tab/ }),
    ).toBeVisible();
    expect(
      (
        await page.context().request.get(api(f.pdf.id, 'media') + '?download=1')
      ).status(),
    ).toBe(403);
    await page.goto(lessonPath(f.image.id));
    await expect(
      page.getByRole('img', { name: 'MentoraLM learning illustration' }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole('img', { name: 'MentoraLM learning illustration' })
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.goto(lessonPath(f.external.id));
    await expect(
      page.getByRole('link', { name: 'Open approved learning link ↗' }),
    ).toHaveAttribute('href', 'https://learning.example.test/course');
    await page.goto('/learn/resources');
    await expect(
      page.getByRole('heading', { name: 'Practice worksheet' }),
    ).toBeVisible();
    const file = await page
      .context()
      .request.get(
        `/api/lms/courses/${f.course.id}/resources/${f.resource.id}/media?download=1`,
      );
    expect(file.status()).toBe(200);
    expect(file.headers()['content-disposition']).toContain('attachment');
    await scan(page);
    for (const route of ['/learn/discussions']) {
      await page.goto(route);
      await expect(page.getByText('Coming in a later phase')).toBeVisible();
    }
    const request = page.context().request;
    for (const body of [
      { userId: student.id },
      { progress: 100 },
      { completedAt: '2026-01-01' },
      { studentId: student.studentId },
    ])
      expect(
        (
          await request.post(api(f.next.id, 'complete'), {
            headers: { Origin: 'http://127.0.0.1:3100' },
            data: body,
          })
        ).status(),
      ).toBe(400);
    expect(
      (
        await request.post(api(f.quiz.id, 'complete'), {
          headers: { Origin: 'http://127.0.0.1:3100' },
          data: {},
        })
      ).status(),
    ).toBe(404);
    expect((await request.get(api(f.draft.id, 'media'))).status()).toBe(404);
    expect(
      (
        await request.post(api(f.next.id, 'complete'), {
          headers: { Origin: 'https://evil.test' },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.get(api(f.video.id, 'media'), {
          headers: { Range: 'bytes=0-15' },
        })
      ).status(),
    ).toBe(206);
    await db.lesson.update({
      where: { itemId: f.video.id },
      data: { storageKey: '../lesson.webm' },
    });
    expect((await request.get(api(f.video.id, 'media'))).status()).toBe(404);
    await db.lesson.update({
      where: { itemId: f.video.id },
      data: { storageKey: 'lesson.webm', mimeType: 'image/svg+xml' },
    });
    expect((await request.get(api(f.video.id, 'media'))).status()).toBe(404);
    await db.lesson.update({
      where: { itemId: f.video.id },
      data: { mimeType: 'video/webm' },
    });
    await writeFile(join(root, 'unsafe.png'), '<script>unsafe</script>');
    await db.lesson.update({
      where: { itemId: f.image.id },
      data: { storageKey: 'unsafe.png' },
    });
    expect((await request.get(api(f.image.id, 'media'))).status()).toBe(404);
    await page.goto(lessonPath(f.image.id));
    await expect(
      page.getByRole('heading', { name: 'Lesson media unavailable' }),
    ).toBeVisible();
    await db.lesson.update({
      where: { itemId: f.image.id },
      data: { storageKey: 'lesson.png' },
    });
    await db.lesson.update({
      where: { itemId: f.external.id },
      data: { externalTargetId: 'https://evil.test' },
    });
    await page.goto(lessonPath(f.external.id));
    await expect(
      page.getByRole('heading', { name: 'Lesson content unavailable' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open approved learning link ↗' }),
    ).toHaveCount(0);
    await db.lesson.update({
      where: { itemId: f.external.id },
      data: { externalTargetId: 'fixture' },
    });
    const context = await page.context().browser()!.newContext();
    try {
      const other = await context.newPage();
      await setupClerkTestingToken({ page: other });
      await other.goto('http://127.0.0.1:3100/');
      await clerk.signIn({ page: other, emailAddress: B.email });
      await other.goto('http://127.0.0.1:3100/learn');
      const studentB = await db.user.findUniqueOrThrow({
        where: { clerkUserId: B.user.id },
      });
      await db.user.update({
        where: { id: studentB.id },
        data: { lmsAccessOverride: 'ENABLED' },
      });
      expect(
        (
          await context.request.get(
            'http://127.0.0.1:3100' + api(f.video.id, 'media'),
          )
        ).status(),
      ).toBe(404);
      expect(
        (
          await context.request.post(
            'http://127.0.0.1:3100' + api(f.first.id, 'complete'),
            { headers: { Origin: 'http://127.0.0.1:3100' }, data: {} },
          )
        ).status(),
      ).toBe(404);
      await other.goto('http://127.0.0.1:3100' + lessonPath(f.first.id));
      await expect(
        other.getByRole('heading', { name: 'Course not available' }),
      ).toBeVisible();
      await db.enrollment.create({
        data: { userId: studentB.id, courseId: f.course.id },
      });
      await other.goto('http://127.0.0.1:3100' + lessonPath(f.first.id));
      await expect(other.locator('.l2-progress')).toContainText('0%');
      await expect(
        other.getByRole('button', { name: 'Mark Complete', exact: true }),
      ).toBeEnabled();
      await expect
        .poll(() =>
          db.lessonState.count({
            where: { userId: studentB.id, itemId: f.first.id },
          }),
        )
        .toBe(1);
      expect(
        (
          await db.lessonState.findUniqueOrThrow({
            where: {
              userId_itemId: { userId: studentB.id, itemId: f.first.id },
            },
          })
        ).completedAt,
      ).toBeNull();
    } finally {
      await context.close();
    }
    if (info.project.name === 'l2-desktop') {
      await page.setViewportSize({ width: 820, height: 1180 });
      await page.goto(lessonPath(f.first.id));
      await expect(
        page.getByRole('button', { name: 'Course Outline', exact: true }),
      ).toBeVisible();
      await scan(page);
    }
    await db.user.update({
      where: { id: student.id },
      data: { lmsAccessOverride: 'DISABLED' },
    });
    expect((await request.get(api(f.video.id, 'media'))).status()).toBe(403);
    expect(
      (
        await request.post(api(f.first.id, 'complete'), {
          headers: { Origin: 'http://127.0.0.1:3100' },
          data: {},
        })
      ).status(),
    ).toBe(403);
    await page.goto(lessonPath(f.first.id));
    await expect(
      page.getByRole('heading', { name: 'Learning access unavailable' }),
    ).toBeVisible();
    await page.goto('/dashboard');
    await expect(page.locator('.d2-learning')).not.toContainText('25%');
    await db.user.update({
      where: { id: student.id },
      data: { lmsAccessOverride: 'ENABLED' },
    });
    await db.enrollment.delete({
      where: { userId_courseId: { userId: student.id, courseId: f.course.id } },
    });
    expect((await request.get(api(f.video.id, 'media'))).status()).toBe(404);
  } finally {
    await db.$disconnect();
    for (const id of users) await client.users.deleteUser(id);
  }
});
