import { test, expect, type Page } from '@playwright/test';
import {
  clerk,
  clerkSetup,
  setupClerkTestingToken,
} from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/nextjs/server';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import AxeBuilder from '@axe-core/playwright';
import { testDatabaseUrl } from './helpers/d4-database';
const development =
  process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_');
const configured = !!process.env.TEST_DATABASE_URL;
const routes = [
  '',
  '/courses',
  '/resources',
  '/support',
  '/referral',
  '/profile',
];
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
async function api(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(`/api/student/${path}`, {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }),
      });
      return {
        status: response.status,
        text: await response.text(),
        cache: response.headers.get('cache-control'),
      };
    },
    { path, method, body },
  );
}
test.beforeAll(async () => {
  if (development) await clerkSetup();
});
test('unauthenticated business API denies access', async ({ request }) => {
  expect((await request.get('/api/student/profile')).status()).toBe(401);
});
test('real Clerk session: unavailable infrastructure is honest and accessible', async ({
  page,
}, info) => {
  test.skip(
    !development || configured,
    'Runs only with Clerk Development and missing test database.',
  );
  const client = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  const email = `d4-${randomBytes(8).toString('hex')}+clerk_test@example.com`;
  const user = await client.users.createUser({
    emailAddress: [email],
    firstName: 'D4 reviewer',
    skipPasswordRequirement: true,
  });
  try {
    await setupClerkTestingToken({ page });
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: email });
    for (const route of routes) {
      await page.goto(`/dashboard${route}`);
      await expect(
        page.getByRole('heading', { name: 'Your workspace' }),
      ).toBeVisible();
      await expect(
        page.getByRole('status').filter({ hasText: /unavailable/i }),
      ).toBeVisible();
      await scan(page);
    }
    expect((await api(page, 'profile')).status).toBe(503);
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await expect(page.locator('.dashboard-shell')).toHaveAttribute(
      'data-dashboard-theme',
      'dark',
    );
    await page.reload();
    await expect(page.locator('.dashboard-shell')).toHaveAttribute(
      'data-dashboard-theme',
      'dark',
    );
    await page.goto('/dashboard');
    mkdirSync('docs/reviews/d4', { recursive: true });
    await page.screenshot({
      path: `docs/reviews/d4/${info.project.name}-unavailable.png`,
    });
    await page.goto('/');
    await expect(page.locator('.dashboard-shell')).toHaveCount(0);
  } finally {
    await client.users.deleteUser(user.id);
  }
});
test('isolated PostgreSQL: real Dashboard persistence, population, ownership and theme', async ({
  page,
}, info) => {
  test.skip(
    !development || !configured,
    'Requires Clerk Development and isolated TEST_DATABASE_URL.',
  );
  if (!/^d4_[a-f0-9]{24}$/.test(process.env.D4_TEST_SCHEMA || ''))
    throw new Error('Isolated test schema is required.');
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: testDatabaseUrl()! },
      { schema: process.env.D4_TEST_SCHEMA },
    ),
  });
  const client = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  const users: string[] = [];
  async function create() {
    const email = `d4-${randomBytes(8).toString('hex')}+clerk_test@example.com`;
    const user = await client.users.createUser({
      emailAddress: [email],
      firstName: 'D4 student',
      skipPasswordRequirement: true,
    });
    users.push(user.id);
    return { user, email };
  }
  try {
    const A = await create(),
      B = await create();
    await setupClerkTestingToken({ page });
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: A.email });
    for (const route of routes) {
      await page.goto(`/dashboard${route}`);
      await expect(page.locator('.dashboard-shell')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Your workspace', exact: true }),
      ).toHaveCount(0);
      await scan(page);
    }
    const actorA = await db.user.findUniqueOrThrow({
      where: { clerkUserId: A.user.id },
    });
    const actorB = await db.user.create({ data: { clerkUserId: B.user.id } });
    const profile = {
      educationLevel: 'Graduate',
      institution: 'D4 test university',
      graduationYear: 2027,
      interests: ['Design'],
      careerGoals: 'Test a secure platform',
    };
    expect((await api(page, 'profile', 'PATCH', profile)).status).toBe(200);
    expect(
      (
        await api(page, 'profile', 'PATCH', {
          ...profile,
          role: 'ADMIN',
          userId: actorB.id,
        })
      ).status,
    ).toBe(400);
    expect((await api(page, `profile?userId=${actorB.id}`)).status).toBe(400);
    const course = await db.course.create({
      data: {
        title: `D4 authorized course ${info.project.name}`,
        description: 'Isolated fixture',
        thumbnailPath: '/images/campus.webp',
        thumbnailAlt: 'Test course',
        publicPath: '/#programs',
        published: true,
      },
    });
    await db.enrollment.create({
      data: { userId: actorA.id, courseId: course.id },
    });
    expect(
      (await api(page, 'courses/view', 'POST', { courseId: course.id })).status,
    ).toBe(200);
    expect(
      (await api(page, 'enrollments', 'POST', { courseId: course.id })).status,
    ).toBe(404);
    const privateFile = await db.resource.create({
      data: {
        title: 'B private resource',
        description: 'Fixture',
        category: 'DOCUMENTS',
        mimeType: 'text/plain',
        fileName: 'fixture.txt',
        storageKey: 'fixture.txt',
        published: true,
        assignments: { create: { userId: actorB.id } },
      },
    });
    const allowedFile = await db.resource.create({
      data: {
        title: `D4 authorized document ${info.project.name}`,
        description: 'Fixture',
        category: 'DOCUMENTS',
        mimeType: 'text/plain',
        fileName: 'fixture.txt',
        storageKey: 'fixture.txt',
        published: true,
        audience: 'STUDENTS',
      },
    });
    expect(
      (await api(page, `resources/${privateFile.id}/download`)).status,
    ).toBe(404);
    const download = await api(page, `resources/${allowedFile.id}/download`);
    expect(download.status).toBe(200);
    expect(download.text).toBe('Authorized D4 test fixture');
    expect(download.cache).toBe('private, no-store');
    expect(
      (await api(page, `resources/${allowedFile.id}/preview`)).status,
    ).toBe(200);
    for (const method of ['POST', 'PATCH', 'DELETE'])
      expect(
        (
          await api(page, 'resources', method, {
            title: 'attack',
            published: true,
          })
        ).status,
      ).toBe(method === 'DELETE' ? 405 : 404);
    const created = await api(page, 'tickets', 'POST', {
      category: 'Technical',
      subject: 'D4 test ticket',
      message: 'Please help with this isolated test.',
    });
    expect(created.status).toBe(201);
    const ticket = JSON.parse(created.text) as { id: string };
    expect(
      (
        await api(page, `tickets/${ticket.id}/reply`, 'POST', {
          message: 'Follow-up test',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api(page, `tickets/${ticket.id}/reply`, 'POST', {
          message: 'attack',
          actor: 'STAFF',
        })
      ).status,
    ).toBe(400);
    const other = await db.supportTicket.create({
      data: {
        userId: actorB.id,
        reference: `D4-${randomBytes(6).toString('hex')}`,
        category: 'General',
        subject: 'Private ticket',
      },
    });
    expect((await api(page, `tickets/${other.id}`)).status).toBe(404);
    expect(
      (
        await api(page, `tickets/${other.id}/reply`, 'POST', {
          message: 'attack',
        })
      ).status,
    ).toBe(404);
    const referral = JSON.parse((await api(page, 'referral')).text) as {
      summary: { code: string };
    };
    expect(
      (
        await api(page, 'referral/attribute', 'POST', {
          code: referral.summary.code,
        })
      ).status,
    ).toBe(409);
    // Real second Clerk session exercises HTTP ownership, beyond repository-only assertions.
    const contextB = await page
      .context()
      .browser()!
      .newContext({ viewport: page.viewportSize()! });
    try {
      const pageB = await contextB.newPage();
      await setupClerkTestingToken({ page: pageB });
      await pageB.goto('http://127.0.0.1:3100/');
      await clerk.signIn({ page: pageB, emailAddress: B.email });
      await pageB.goto('http://127.0.0.1:3100/dashboard');
      expect(JSON.parse((await api(pageB, 'profile')).text)).toBeNull();
      const Bcourses = JSON.parse((await api(pageB, 'courses')).text);
      expect(Bcourses).toMatchObject({ viewed: [], enrolled: [] });
      for (const endpoint of [
        'profile',
        'courses',
        'resources',
        'tickets',
        'referral',
      ]) {
        expect(
          (await api(page, `${endpoint}?userId=${actorB.id}`)).status,
        ).toBe(400);
        expect(
          (await api(pageB, `${endpoint}?userId=${actorA.id}`)).status,
        ).toBe(400);
      }
      expect((await api(pageB, `tickets/${ticket.id}`)).status).toBe(404);
      expect(
        (
          await api(pageB, `tickets/${ticket.id}/reply`, 'POST', {
            message: 'IDOR attack',
          })
        ).status,
      ).toBe(404);
      expect((await api(pageB, `tickets/${other.id}`)).status).toBe(200);
      expect(
        (await api(pageB, `resources/${privateFile.id}/download`)).status,
      ).toBe(200);
      const Bresources = JSON.parse(
        (await api(pageB, 'resources')).text,
      ).resources;
      expect(
        Bresources.some((row: { id: string }) => row.id === privateFile.id),
      ).toBe(true);
      const Aresources = JSON.parse(
        (await api(page, 'resources')).text,
      ).resources;
      expect(
        Aresources.some((row: { id: string }) => row.id === privateFile.id),
      ).toBe(false);
      expect(
        (
          await api(pageB, 'referral/attribute', 'POST', {
            code: referral.summary.code,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await api(pageB, 'referral/attribute', 'POST', {
            code: referral.summary.code,
          })
        ).status,
      ).toBe(200);
      const secondReferral = JSON.parse((await api(pageB, 'referral')).text);
      expect(secondReferral.summary.code).not.toBe(referral.summary.code);
      expect(secondReferral.summary.history).toEqual([]);
      expect(
        (
          await api(pageB, 'referral/attribute', 'POST', {
            code: secondReferral.summary.code,
          })
        ).status,
      ).toBe(409);
      const C = await db.user.create({
        data: {
          clerkUserId: `fixture_${randomBytes(8).toString('hex')}`,
          referral: { create: { code: randomBytes(24).toString('base64url') } },
        },
        include: { referral: true },
      });
      expect(
        (
          await api(pageB, 'referral/attribute', 'POST', {
            code: C.referral!.code,
          })
        ).status,
      ).toBe(409);
      expect(
        JSON.parse((await api(page, 'referral')).text).summary.history,
      ).toMatchObject([{ status: 'joined', displayName: 'MentoraLM member' }]);
      await clerk.signOut({ page: pageB });
    } finally {
      await contextB.close();
    }
    const unsafe = await db.resource.create({
      data: {
        title: 'Unsafe fixture',
        description: 'Fixture',
        category: 'OTHER',
        mimeType: 'image/svg+xml',
        fileName: 'fixture.svg',
        storageKey: 'fixture.txt',
        published: true,
        audience: 'STUDENTS',
      },
    });
    expect((await api(page, `resources/${unsafe.id}/preview`)).status).toBe(
      404,
    );
    await db.resource.update({
      where: { id: unsafe.id },
      data: { mimeType: 'application/pdf' },
    });
    expect((await api(page, `resources/${unsafe.id}/preview`)).status).toBe(
      404,
    );
    await db.resource.update({
      where: { id: unsafe.id },
      data: { storageKey: '../fixture.txt' },
    });
    expect((await api(page, `resources/${unsafe.id}/download`)).status).toBe(
      404,
    );
    await db.resource.update({
      where: { id: unsafe.id },
      data: { published: false },
    });
    expect(
      (
        await page
          .context()
          .request.post('http://127.0.0.1:3100/api/student/tickets', {
            headers: { Origin: 'https://attacker.test' },
            data: { category: 'General', subject: 'CSRF', message: 'attack' },
          })
      ).status(),
    ).toBe(403);
    await page.goto('/dashboard/profile');
    await page.getByRole('button', { name: 'Edit education & career' }).click();
    await page
      .getByLabel('Career goals', { exact: true })
      .fill('Updated through real profile form');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Profile saved.' }),
    ).toBeVisible();
    expect(
      (
        await db.studentProfile.findUniqueOrThrow({
          where: { userId: actorA.id },
        })
      ).careerGoals,
    ).toBe('Updated through real profile form');
    await page.goto('/dashboard/support');
    await page
      .getByRole('button', { name: 'D4 test ticket', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByLabel('Reply', { exact: true })
      .fill('Persisted through real reply form');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(
      page
        .getByRole('dialog')
        .getByText('Persisted through real reply form', { exact: true }),
    ).toBeVisible();
    await scan(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await page
      .getByLabel('Subject', { exact: true })
      .fill('Created through real ticket form');
    await page
      .getByLabel('Message', { exact: true })
      .fill('Persisted initial message');
    await page.getByRole('button', { name: 'Submit ticket' }).click();
    await expect(
      page.getByRole('button', {
        name: 'Created through real ticket form',
        exact: true,
      }),
    ).toBeVisible();
    expect(await db.supportTicket.count({ where: { userId: actorA.id } })).toBe(
      2,
    );
    for (const route of routes) {
      await page.goto(`/dashboard${route}`);
      await scan(page);
    }
    await page.goto('/dashboard/profile');
    await expect(
      page.getByText('D4 test university', { exact: true }),
    ).toBeVisible();
    await page.context().addCookies([
      {
        name: 'mentoralm-dashboard-theme',
        value: 'dark',
        url: 'http://127.0.0.1:3100/dashboard',
      },
    ]);
    await page.goto('/dashboard');
    await expect(page.locator('.dashboard-shell')).toHaveAttribute(
      'data-dashboard-theme',
      'dark',
    );
    await page.reload();
    await expect(page.locator('.dashboard-shell')).toHaveAttribute(
      'data-dashboard-theme',
      'dark',
    );
    mkdirSync('docs/reviews/d4', { recursive: true });
    await page.screenshot({
      path: `docs/reviews/d4/${info.project.name}-populated.png`,
    });
    await page.goto('/');
    await expect(page.locator('.dashboard-shell')).toHaveCount(0);
  } finally {
    await db.$disconnect();
    for (const id of users) await client.users.deleteUser(id);
  }
});

test('isolated UI fixtures: profile save, support validation/success/error, keyboard and accessibility', async ({
  page,
}, info) => {
  test.setTimeout(30000);
  page.on('pageerror', (error) => {
    console.error('D4 fixture error:', error.message);
  });
  // UI contract tests only: intercepted responses do not establish database persistence.
  const { execFileSync } = await import('node:child_process');
  const { readFileSync } = await import('node:fs');
  execFileSync(process.execPath, ['tests/helpers/build-d3-fixtures.cjs']);
  async function fixture(data: unknown) {
    await page.goto('/');
    await page.setContent('<div id="fixture-root"></div>');
    await page.evaluate((data) => {
      document.getElementById('fixture-root')!.dataset.fixture =
        JSON.stringify(data);
    }, data);
    await page.addStyleTag({
      content: [
        'tokens.css',
        'global.css',
        'dashboard.css',
        'dashboard-theme.css',
        'dashboard-features.css',
      ]
        .map((file) => readFileSync(`src/styles/${file}`, 'utf8'))
        .join('\n'),
    });
    await page.addScriptTag({ path: 'docs/reviews/d3/fixture-bundle.js' });
  }
  let received: unknown;
  await page.route('**/api/student/profile', async (route) => {
    received = route.request().postDataJSON();
    await route.fulfill({ json: { saved: true } });
  });
  await fixture({ surface: 'profile' });
  await page
    .getByLabel('Institution', { exact: true })
    .fill('Isolated UI university');
  await page.getByLabel('Interests', { exact: true }).fill('Design, Research');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.saved))
    .toBe('true');
  expect(received).toMatchObject({
    institution: 'Isolated UI university',
    interests: ['Design', 'Research'],
  });
  await scan(page);
  await fixture({ surface: 'support', tickets: [] });
  await page.getByRole('button', { name: 'Create Ticket' }).click();
  await page.getByRole('button', { name: 'Submit ticket' }).click();
  await expect(page.getByLabel('Subject', { exact: true })).toBeFocused();
  await page.getByLabel('Subject', { exact: true }).fill('Isolated UI ticket');
  await page
    .getByLabel('Message', { exact: true })
    .fill('Test support request');
  await page.route('**/api/student/tickets', (route) =>
    route.fulfill({
      status: 503,
      json: { error: 'Student data is temporarily unavailable.' },
    }),
  );
  await page.getByRole('button', { name: 'Submit ticket' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(
    'temporarily unavailable',
  );
  await scan(page);
  mkdirSync('docs/reviews/d4', { recursive: true });
  await page.screenshot({
    path: `docs/reviews/d4/${info.project.name}-support-ui.png`,
  });
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Create Ticket' }),
  ).toBeFocused();
  await page.unroute('**/api/student/tickets');
  await page.route('**/api/student/tickets', (route) =>
    route.fulfill({ status: 201, json: { id: 'isolated-ticket' } }),
  );
  await page.getByRole('button', { name: 'Create Ticket' }).click();
  await page.getByLabel('Subject', { exact: true }).fill('Isolated UI ticket');
  await page
    .getByLabel('Message', { exact: true })
    .fill('Test support request');
  await page.getByRole('button', { name: 'Submit ticket' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Ticket created.');
});
