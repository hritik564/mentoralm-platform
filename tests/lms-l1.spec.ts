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
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const routes = [
  '/learn',
  '/learn/lectures',
  '/learn/assignments',
  '/learn/resources',
  '/learn/discussions',
  '/learn/chat',
  '/learn/courses/unknown',
];
const review = 'docs/reviews/l1';
mkdirSync(review, { recursive: true });
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
  if (
    !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') ||
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_')
  )
    throw new Error('L1 tests require Clerk Development.');
  await clerkSetup();
});
test('all LMS routes require authentication and reject unsafe post-login destinations', async ({
  request,
}) => {
  for (const route of routes) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const url = new URL(response.headers().location, 'http://127.0.0.1:3100');
    expect(url.pathname).toBe('/sign-in');
    expect(url.origin).toBe('http://127.0.0.1:3100');
  }
  const canonicalPort = await request.get('/', {
    headers: { Host: 'students.mentoralm.com:443' },
    maxRedirects: 0,
  });
  expect(canonicalPort.status()).toBe(307);
  for (const path of ['/', '/lectures', '/courses/unknown']) {
    const response = await request.get(path, {
      headers: { Host: 'students.mentoralm.com' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(
      new URL(response.headers().location, 'http://127.0.0.1:3100').pathname,
    ).toBe('/sign-in');
  }
  expect(
    (await request.get('/sign-in?redirect_url=https://evil.test')).url(),
  ).toContain('/sign-in');
});
test('real LMS identity, empty/future states, cohorts, course structure, ownership and Dashboard handoff', async ({
  page,
}, info) => {
  if (!/^d4_[a-f0-9]{24}$/.test(process.env.D4_TEST_SCHEMA || ''))
    throw new Error('Isolated schema required');
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: testDatabaseUrl()! },
      { schema: process.env.D4_TEST_SCHEMA },
    ),
  });
  const client = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  const ids: string[] = [];
  async function account() {
    const email = `l1-${randomBytes(8).toString('hex')}+clerk_test@example.com`;
    const user = await client.users.createUser({
      emailAddress: [email],
      firstName: 'L1 learner',
      skipPasswordRequirement: true,
    });
    ids.push(user.id);
    return { user, email };
  }
  try {
    const A = await account(),
      B = await account();
    await setupClerkTestingToken({ page });
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: A.email });
    await page.goto('/learn');
    await expect(
      page.getByRole('heading', { name: 'Learning access unavailable' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Contact Support' }),
    ).toHaveAttribute('href', '/dashboard/support');
    await scan(page);
    await page.screenshot({
      path: `${review}/${info.project.name}-access-unavailable.png`,
      fullPage: true,
    });
    const student = await db.user.findUniqueOrThrow({
      where: { clerkUserId: A.user.id },
    });
    for (const route of routes) {
      await page.goto(route);
      await expect(
        page.getByRole('heading', { name: 'Learning access unavailable' }),
      ).toBeVisible();
      await expect(page.locator('body')).not.toContainText(student.studentId!);
    }
    const deniedRoot = await page
      .context()
      .request.get('/', { headers: { Host: 'students.mentoralm.com' } });
    expect(deniedRoot.status()).toBe(200);
    expect(await deniedRoot.text()).toContain('Learning access unavailable');
    await db.user.update({
      where: { id: student.id },
      data: { lmsAccessOverride: 'ENABLED' },
    });
    await page.goto('/learn');
    await expect(
      page.getByRole('heading', { name: 'Welcome, L1 learner.' }),
    ).toBeVisible();
    expect(student.studentId).toMatch(/^MLM-STU-\d{4}-\d{6,}$/);
    await expect(page.locator('.lms-identity')).toContainText(
      student.studentId!,
    );
    await expect(
      page.getByText('Batch not assigned', { exact: true }),
    ).toBeVisible();
    await scan(page);
    await page.screenshot({
      path: `${review}/${info.project.name}-home.png`,
      fullPage: true,
    });
    await page.goto('/learn/lectures');
    await expect(
      page.getByText('No enrolled courses with learning access yet.'),
    ).toBeVisible();
    for (const label of ['Lectures', 'Assignments', 'Resources', 'Discussions'])
      await expect(
        page
          .getByRole('navigation', { name: 'Learn navigation' })
          .getByRole('link', { name: label, exact: true }),
      ).toBeVisible();
    await scan(page);
    await page.screenshot({
      path: `${review}/${info.project.name}-learn.png`,
      fullPage: true,
    });
    for (const route of [
      '/learn/assignments',
      '/learn/discussions',
      '/learn/chat',
    ]) {
      await page.goto(route);
      await expect(page.getByText('Coming in a later phase')).toBeVisible();
      await scan(page);
    }
    if (info.project.name === 'l1-desktop') {
      await page.goto('/learn/assignments');
      await page.screenshot({
        path: `${review}/l1-desktop-assignments.png`,
        fullPage: true,
      });
    }
    const suffix = info.project.name;
    const program = await db.program.create({
      data: { title: `Fixture Program ${suffix}` },
    });
    const course = await db.course.create({
      data: {
        title: `Communication Skills ${suffix}`,
        description: 'Published course outline fixture',
        programId: program.id,
        published: true,
        thumbnailPath: '/images/campus.webp',
        thumbnailAlt: 'Fixture',
        publicPath: '/#programs',
      },
    });
    const cohort = await db.batch.create({
      data: {
        code: suffix === 'l1-desktop' ? 'CIG-2026-OCT-A' : 'CIG-2026-OCT-B',
        name: `October cohort ${suffix}`,
        lmsAccessEnabled: true,
        status: 'ACTIVE',
        programId: program.id,
        startsAt: new Date('2020-01-01'),
      },
    });
    const second = await db.batch.create({
      data: {
        code: suffix === 'l1-desktop' ? 'GRAD-2027-A' : 'GRAD-2027-B',
        name: 'Future cohort',
        courseId: course.id,
        startsAt: new Date('2030-01-01'),
      },
    });
    await db.batchMembership.createMany({
      data: [
        { userId: student.id, batchId: cohort.id },
        { userId: student.id, batchId: second.id },
      ],
    });
    await db.enrollment.create({
      data: { userId: student.id, courseId: course.id },
    });
    await db.user.update({
      where: { id: student.id },
      data: { lmsAccessOverride: null },
    });
    const section = await db.section.create({
      data: {
        courseId: course.id,
        title: 'Communication foundations',
        position: 1,
        published: true,
      },
    });
    await db.learningItem.createMany({
      data: [
        {
          sectionId: section.id,
          title: 'Speaking with clarity',
          type: 'LESSON',
          position: 1,
          published: true,
        },
        {
          sectionId: section.id,
          title: 'Communication reading',
          type: 'RESOURCE',
          position: 2,
          published: true,
        },
        {
          sectionId: section.id,
          title: 'Future knowledge check',
          type: 'QUIZ',
          position: 3,
          published: true,
        },
        {
          sectionId: section.id,
          title: 'PRIVATE DRAFT',
          type: 'ASSESSMENT',
          position: 4,
        },
      ],
    });
    await page.goto('/learn');
    await expect(page.locator('.lms-current')).toContainText(cohort.name);
    await expect(page.locator('.lms-current')).toContainText(cohort.code);
    await expect(
      page.getByRole('heading', { name: 'Future cohort', exact: true }),
    ).toBeVisible();
    await scan(page);
    await page.goto(`/learn/courses/${course.id}`);
    await expect(
      page.getByRole('heading', { name: course.title, exact: true }),
    ).toBeVisible();
    if (suffix === 'l1-mobile')
      await page
        .getByRole('button', { name: 'Course Outline', exact: true })
        .click();
    const outline =
      suffix === 'l1-mobile'
        ? page.getByRole('dialog', { name: 'Course Outline' })
        : page.locator('.l2-outline');
    await expect(
      outline
        .locator('.l2-future-item')
        .filter({ hasText: 'Speaking with clarity' }),
    ).toBeVisible();
    await expect(page.getByText('PRIVATE DRAFT', { exact: true })).toHaveCount(
      0,
    );
    const outlineRows = await outline
      .locator('.l2-future-item')
      .allTextContents();
    expect(outlineRows.length).toBe(3);
    [
      'Speaking with clarity',
      'Communication reading',
      'Future knowledge check',
    ].forEach((title, index) => expect(outlineRows[index]).toContain(title));
    await scan(page);
    if (suffix === 'l1-mobile') await page.keyboard.press('Escape');
    if (suffix === 'l1-desktop')
      await page.screenshot({
        path: `${review}/l1-desktop-course-populated.png`,
        fullPage: true,
      });
    await page.goto('/dashboard/courses');
    await expect(page.locator('body')).not.toContainText(student.studentId!);
    await expect(page.locator('body')).not.toContainText(cohort.code);
    await page
      .getByRole('link', { name: `Open LMS: ${course.title}`, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/learn/courses/${course.id}$`));
    await expect(
      page.getByRole('heading', { name: course.title, exact: true }),
    ).toBeVisible();
    await page.goto('/dashboard');
    await page
      .getByRole('link', { name: `Open LMS: ${course.title}`, exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/learn/courses/${course.id}$`));
    const ownProfile = {
      educationLevel: null,
      institution: null,
      graduationYear: null,
      interests: [],
      careerGoals: null,
    };
    for (const injection of [
      { studentId: student.studentId },
      { role: 'INSTRUCTOR' },
      { lmsAccessOverride: 'ENABLED' },
      { lmsAccessEnabled: true },
      { batchId: cohort.id },
      { userId: student.id },
    ]) {
      const response = await page
        .context()
        .request.patch('http://127.0.0.1:3100/api/student/profile', {
          headers: { Origin: 'http://127.0.0.1:3100' },
          data: { ...ownProfile, ...injection },
        });
      expect(response.status()).toBe(400);
    }
    for (const path of [
      'batches',
      'batch-memberships',
      'batch-instructors',
      'lms-entitlement',
      'enrollments',
    ])
      expect(
        (
          await page
            .context()
            .request.post(`http://127.0.0.1:3100/api/student/${path}`, {
              headers: { Origin: 'http://127.0.0.1:3100' },
              data: { batchId: cohort.id, userId: student.id },
            })
        ).status(),
      ).toBe(404);
    const contextB = await page
      .context()
      .browser()!
      .newContext({ viewport: page.viewportSize()! });
    try {
      const pageB = await contextB.newPage();
      await setupClerkTestingToken({ page: pageB });
      await pageB.goto('http://127.0.0.1:3100/');
      await clerk.signIn({ page: pageB, emailAddress: B.email });
      await pageB.goto('http://127.0.0.1:3100/learn');
      const other = await db.user.findUniqueOrThrow({
        where: { clerkUserId: B.user.id },
      });
      await db.batchMembership.create({
        data: { userId: other.id, batchId: cohort.id },
      });
      for (const key of [
        course.id,
        student.studentId!,
        student.id,
        'unknown',
      ]) {
        await pageB.goto(`http://127.0.0.1:3100/learn/courses/${key}`);
        await expect(
          pageB.getByRole('heading', {
            name: 'Course not available',
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          pageB.getByText('Speaking with clarity', { exact: true }),
        ).toHaveCount(0);
      }
      await pageB.goto('http://127.0.0.1:3100/learn');
      await expect(pageB.locator('.lms-identity')).toContainText(
        other.studentId!,
      );
      await expect(pageB.locator('body')).not.toContainText(student.studentId!);
      await expect(
        pageB.getByRole('link', { name: `Open course: ${course.title}` }),
      ).toHaveCount(0);
    } finally {
      await contextB.close();
    }
    // Business-data changes take effect on direct navigation without session changes.
    await db.user.update({
      where: { id: student.id },
      data: { lmsAccessOverride: 'DISABLED' },
    });
    for (const route of [...routes, `/learn/courses/${course.id}`]) {
      await page.goto(route);
      await expect(
        page.getByRole('heading', { name: 'Learning access unavailable' }),
      ).toBeVisible();
      await expect(page.locator('body')).not.toContainText(student.studentId!);
      await expect(page.locator('body')).not.toContainText(
        'Speaking with clarity',
      );
    }
    const deniedCourse = await page
      .context()
      .request.get(`/courses/${course.id}`, {
        headers: { Host: 'students.mentoralm.com' },
      });
    expect(await deniedCourse.text()).toContain('Learning access unavailable');
    await db.user.update({
      where: { id: student.id },
      data: { lmsAccessOverride: null },
    });
    await db.batch.update({
      where: { id: cohort.id },
      data: { lmsAccessEnabled: false },
    });
    await page.goto(`/learn/courses/${course.id}`);
    await expect(
      page.getByRole('heading', { name: 'Learning access unavailable' }),
    ).toBeVisible();
    await db.user.update({
      where: { id: student.id },
      data: { lmsAccessOverride: 'ENABLED' },
    });
    await page.goto(`/learn/courses/${course.id}`);
    await expect(
      page.getByRole('heading', { name: course.title, exact: true }),
    ).toBeVisible();
    await db.user.update({
      where: { id: student.id },
      data: { lmsAccessOverride: null },
    });
    await db.batch.update({
      where: { id: cohort.id },
      data: { lmsAccessEnabled: true },
    });
    await page.goto('/');
    await expect(page.locator('body')).not.toContainText(student.studentId!);
    await expect(page.locator('body')).not.toContainText(cohort.code);
    if (suffix === 'l1-desktop') {
      await page.setViewportSize({ width: 820, height: 1180 });
      await page.goto('/learn');
      await scan(page);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  } finally {
    await db.$disconnect();
    for (const id of ids) await client.users.deleteUser(id);
  }
});
