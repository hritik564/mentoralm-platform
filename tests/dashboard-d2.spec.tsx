import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import {
  clerk,
  clerkSetup,
  setupClerkTestingToken,
} from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/nextjs/server';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import {
  publicCourseDestination,
  type EnrolledCourse,
  type ViewedCourse,
} from '../src/lib/dashboard/courses';
import {
  resolveLearningLaunch,
  type LearningLaunchRegistry,
} from '../src/lib/dashboard/learning-launch';

const development =
  process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_');
const review = 'docs/reviews/d2';
mkdirSync(review, { recursive: true });
const registry: LearningLaunchRegistry = {
  destinations: {
    learning: '/learning/test-course',
    relocated: 'https://learning.example.test/course/test-course',
  },
  trustedOrigins: ['https://learning.example.test'],
};
const enrolled: EnrolledCourse = {
  kind: 'enrolled',
  id: 'test-enrolled',
  title: 'Test learning course',
  program: 'Test program',
  thumbnail: { src: '/images/campus.webp', alt: 'Test campus thumbnail' },
  publicDestination: '/#programs',
  status: 'in-progress',
  progress: 35,
  nextLesson: 'Test next lesson',
  lastAccessed: '2026-09-29T12:00:00Z',
  learningTarget: { destinationId: 'learning' },
};
const viewed: ViewedCourse = {
  kind: 'viewed',
  id: 'test-viewed',
  title: 'Test viewed course',
  program: 'Test program',
  thumbnail: { src: '/images/learner.webp', alt: 'Test learner thumbnail' },
  publicDestination: '/#programs',
  description: 'Fixture course description.',
  lastViewed: '2026-09-28T12:00:00Z',
};
function renderFixtures(
  records: {
    course: EnrolledCourse | ViewedCourse;
    registry?: LearningLaunchRegistry;
    resume?: boolean;
  }[],
) {
  return execFileSync(process.execPath, ['tests/helpers/render-courses.cjs'], {
    input: JSON.stringify(records),
    encoding: 'utf8',
  });
}
async function scan(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .include('.dashboard-shell')
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
  if (development) await clerkSetup();
});

test('empty source and controlled launch reject arbitrary destinations', () => {
  expect(resolveLearningLaunch(enrolled.learningTarget)).toBeNull();
  expect(resolveLearningLaunch(enrolled.learningTarget, registry)).toBe(
    '/learning/test-course',
  );
  expect(resolveLearningLaunch({ destinationId: 'relocated' }, registry)).toBe(
    'https://learning.example.test/course/test-course',
  );
  for (const destinationId of [
    'https://evil.test',
    '//evil.test',
    '__proto__',
    'unknown',
    '../learning',
  ])
    expect(resolveLearningLaunch({ destinationId }, registry)).toBeNull();
  for (const url of [
    'https://evil.test/course',
    'javascript:alert(1)',
    '//evil.test',
    '/learning/../admin',
    '/learning/%2e%2e/admin',
    '/learning\\evil',
    '/learning?redirect=https://evil.test',
    'https://user:pass@learning.example.test/course',
    'https://learning.example.test.evil.test/course',
    'https://learning.example.test/../admin',
  ]) {
    expect(
      resolveLearningLaunch(
        { destinationId: 'unsafe' },
        { ...registry, destinations: { unsafe: url } },
      ),
    ).toBeNull();
  }
  for (const url of [
    '//evil.test',
    'javascript:alert(1)',
    '/%2f%2fevil',
    '/course?redirect=evil',
    '/a/../b',
  ])
    expect(publicCourseDestination(url)).toBeNull();
});

test('typed fixtures render viewed, enrolled, completed and resume states without runtime records', async ({
  page,
}) => {
  await page.setContent(
    renderFixtures([
      { course: viewed },
      { course: { ...enrolled, status: 'enrolled', progress: null }, registry },
      { course: { ...enrolled, status: 'completed', progress: 100 } },
      { course: enrolled, registry, resume: true },
    ]),
  );
  await page.addStyleTag({
    content: readFileSync('src/styles/dashboard-courses.css', 'utf8'),
  });
  await expect(
    page.getByRole('link', { name: 'View Course: Test viewed course' }),
  ).toHaveAttribute('href', '/#programs');
  await expect(
    page.getByRole('link', { name: 'Open LMS: Test learning course' }),
  ).toHaveAttribute('href', '/learning/test-course');
  await expect(
    page.getByRole('link', { name: 'Continue Learning: Test learning course' }),
  ).toHaveAttribute('href', '/learning/test-course');
  await expect(
    page.getByRole('link', { name: 'View Course: Test learning course' }),
  ).toHaveAttribute('href', '/#programs');
  await expect(page.getByText('Next: Test next lesson')).toHaveCount(3);
  await expect(page.getByRole('progressbar')).toHaveCount(2);
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await page.setContent(
    renderFixtures([
      {
        course: {
          ...enrolled,
          learningTarget: { destinationId: 'https://evil.test' },
          progress: -1,
        },
      },
    ]),
  );
  await expect(page.getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(
    page.getByText('Learning entry is not available yet.'),
  ).toBeVisible();
});

test('D2 remains server protected', async ({ request }) => {
  for (const path of ['/dashboard', '/dashboard/courses']) {
    const result = await request.get(`${path}?userId=forged`, {
      maxRedirects: 0,
    });
    expect([302, 303, 307, 308]).toContain(result.status());
    expect(
      new URL(result.headers().location, 'http://127.0.0.1:3100').pathname,
    ).toBe('/sign-in');
  }
});

test('real Clerk overview, honest empties, course tabs, keyboard, valid discovery and axe', async ({
  page,
}, testInfo) => {
  test.skip(
    !development,
    'Real identity validation requires Clerk development keys.',
  );
  const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const email = `d2-${Date.now()}-${randomBytes(4).toString('hex')}+clerk_test@example.com`;
  const user = await client.users.createUser({
    emailAddress: [email],
    firstName: 'D2 Reviewer',
    lastName: 'Test',
    skipPasswordRequirement: true,
  });
  try {
    await setupClerkTestingToken({ page });
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: email });
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Welcome back, D2 Reviewer.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'No active learning yet.' }),
    ).toBeVisible();
    await expect(
      page.getByText('Courses you view or enroll in will appear here.'),
    ).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.locator('.d2-course-card')).toHaveCount(0);
    await expect(page.locator('.dashboard-content')).not.toContainText(
      /\d+%|streak|hours learned|certificates earned/,
    );
    await expect(
      page.getByRole('link', { name: 'Explore Programs' }).first(),
    ).toHaveAttribute('href', '/#programs');
    await scan(page);
    await page.screenshot({
      path: `${review}/${testInfo.project.name}-overview.png`,
      fullPage: true,
    });
    await page.getByRole('link', { name: 'View My Courses' }).click();
    await expect(page).toHaveURL(/\/dashboard\/courses$/);
    const enrolledTab = page.getByRole('tab', { name: 'Enrolled Courses' });
    const viewedTab = page.getByRole('tab', { name: 'Viewed Courses' });
    await expect(enrolledTab).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('heading', {
        name: "You haven't enrolled in a course yet.",
      }),
    ).toBeVisible();
    await scan(page);
    await page.screenshot({
      path: `${review}/${testInfo.project.name}-courses-enrolled.png`,
      fullPage: true,
    });
    await enrolledTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(viewedTab).toBeFocused();
    await expect(viewedTab).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('heading', {
        name: 'Courses you explore will appear here.',
      }),
    ).toBeVisible();
    await page.keyboard.press('Home');
    await expect(enrolledTab).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(viewedTab).toBeFocused();
    await page.keyboard.press('End');
    await expect(viewedTab).toBeFocused();
    await enrolledTab.click();
    await expect(enrolledTab).toHaveAttribute('aria-selected', 'true');
    await viewedTab.click();
    await scan(page);
    if (testInfo.project.name === 'd2-desktop')
      await page.screenshot({
        path: `${review}/d2-desktop-courses-viewed.png`,
        fullPage: true,
      });
    await page
      .getByRole('link', { name: 'Explore Programs', exact: false })
      .last()
      .click();
    await expect(page).toHaveURL(/\/#programs$/);
    await expect(page.locator('#programs')).toBeVisible();
    // A missing provider first name also renders honestly, with no synthetic name.
    await client.users.updateUser(user.id, { firstName: '' });
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Welcome back.', exact: true }),
    ).toBeVisible();
  } finally {
    await client.users.deleteUser(user.id);
  }
});
