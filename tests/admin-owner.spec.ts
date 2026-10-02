import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { localSeedUrl, verifyDatabase } from '../scripts/lms-owner/safety';
loadEnvConfig(process.cwd(), true);
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { studentSnapshot } from '../scripts/admin-owner/snapshot';
import { mkdir, writeFile } from 'node:fs/promises';
test('Dedicated Admin sign-in branding, Clerk-controlled auth and Light/Dark captures', async ({
  page,
  context,
  request,
}) => {
  await mkdir('docs/reviews/admin-owner', { recursive: true });
  const native = await request.get('/sign-in', {
    headers: { host: 'admin.mentoralm.com' },
  });
  expect(native.status()).toBe(200);
  expect(await native.text()).toContain('Admin Console');
  for (const theme of ['light', 'dark']) {
    await context.addCookies([
      {
        name: 'mentoralm-product-theme',
        value: theme,
        url: 'http://127.0.0.1:3000',
      },
    ]);
    await page.goto('/admin-auth/sign-in');
    await expect(
      page.getByText('Admin Console', { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.locator('.admin-wordmark')).toHaveText('Mentora.');
    await expect(page.locator('.admin-shell')).toHaveAttribute(
      'data-admin-theme',
      theme,
    );
    await expect(
      page.getByRole('link', { name: /sign up|create account/i }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `docs/reviews/admin-owner/1440-sign-in-${theme}.png`,
    });
  }
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('.admin-shell')).toHaveAttribute(
    'data-admin-theme',
    'light',
  );
  await page.reload();
  await expect(page.locator('.admin-shell')).toHaveAttribute(
    'data-admin-theme',
    'light',
  );
});

test('Real owner uses Admin and Student surfaces; revoke is immediate and learning history is intact', async ({
  page,
}) => {
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: localSeedUrl(process.env) },
      { schema: 'public' },
    ),
  });
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const tokenIds: string[] = [],
    sessionIds: string[] = [];
  let revoked = false;
  const roleCommand = (operation: 'grant' | 'revoke') =>
    execFileSync(
      process.execPath,
      [
        'node_modules/tsx/dist/cli.mjs',
        'scripts/admin-owner/roles.ts',
        operation,
        'arcaderobo3@gmail.com',
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: 'development',
          NODE_OPTIONS: '--conditions=react-server',
        },
        stdio: 'pipe',
      },
    );
  try {
    await verifyDatabase(db);
    const users = (
      await clerk.users.getUserList({
        emailAddress: ['arcaderobo3@gmail.com'],
        limit: 2,
      })
    ).data;
    expect(users.length).toBe(1);
    const owner = await db.user.findUniqueOrThrow({
      where: { clerkUserId: users[0].id },
    });
    const before = await studentSnapshot(db, owner.id);
    expect(before.primaryRole).toBe('STUDENT');
    expect(
      await db.userRoleAssignment.count({
        where: { userId: owner.id, role: 'ADMIN' },
      }),
    ).toBe(1);
    async function signIn() {
      await page.goto('/admin-auth/sign-in');
      await page.waitForFunction(
        () =>
          !!(window as unknown as { Clerk?: { loaded: boolean } }).Clerk
            ?.loaded,
      );
      const token = await clerk.signInTokens.createSignInToken({
        userId: users[0].id,
        expiresInSeconds: 180,
      });
      tokenIds.push(token.id);
      const id = await page.evaluate(async (ticket) => {
        const c = (
          window as unknown as {
            Clerk: {
              client: {
                signIn: {
                  create: (v: {
                    strategy: string;
                    ticket: string;
                  }) => Promise<{ createdSessionId: string }>;
                };
              };
              setActive: (v: { session: string }) => Promise<void>;
            };
          }
        ).Clerk;
        const attempt = await c.client.signIn.create({
          strategy: 'ticket',
          ticket,
        });
        await c.setActive({ session: attempt.createdSessionId });
        return attempt.createdSessionId;
      }, token.token);
      sessionIds.push(id);
      await page.goto('/admin-auth/sign-in');
      await expect(page).toHaveURL('/admin');
      await expect(
        page.getByRole('heading', { name: 'Overview', exact: true }),
      ).toBeVisible();
      await expect(page.locator('.admin-metrics')).toBeVisible();
    }
    async function capture(name: string) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `docs/reviews/admin-owner/1440-${name}.png`,
      });
    }
    await page.context().addCookies([
      {
        name: 'mentoralm-product-theme',
        value: 'dark',
        url: 'http://127.0.0.1:3000',
      },
    ]);
    await signIn();
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await expect(page.locator('.admin-shell')).toHaveAttribute(
      'data-admin-theme',
      'light',
    );
    await capture('overview');
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await expect(page.locator('.admin-shell')).toHaveAttribute(
      'data-admin-theme',
      'dark',
    );
    await page.reload();
    await expect(page.locator('.admin-shell')).toHaveAttribute(
      'data-admin-theme',
      'dark',
    );
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await page.goto('/admin/students');
    await expect(
      page.getByRole('heading', { name: 'Students', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(owner.studentId!, { exact: true }),
    ).toBeVisible();
    await capture('students');
    const studentsResponse = await page.request.get(
      `/api/admin/students?q=${owner.studentId}`,
    );
    expect(studentsResponse.status()).toBe(200);
    const students = (await studentsResponse.json()) as {
      rows: { ref: string; studentId: string }[];
    };
    const studentRef = students.rows.find(
      (s) => s.studentId === owner.studentId,
    )!.ref;
    await page.goto(`/admin/students/${studentRef}`);
    await expect(
      page.getByRole('heading', { name: 'Personal information', exact: true }),
    ).toBeVisible();
    await capture('student-detail');
    const detail = (await (
      await page.request.get(`/api/admin/students/${studentRef}`)
    ).json()) as { memberships: { batchRef: string }[] };
    expect(detail.memberships.length).toBeGreaterThan(0);
    await page.goto('/admin/batches');
    await expect(
      page.getByRole('heading', { name: 'Batches', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.admin-table-scroll')).toBeVisible();
    await page.goto(`/admin/batches/${detail.memberships[0].batchRef}`);
    await expect(
      page.getByRole('button', { name: 'Live Sessions', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Live Sessions', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Live Sessions', exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('.admin-session-list button').first(),
    ).toBeVisible();
    await capture('batch-live-sessions');
    for (const route of ['/dashboard', '/learn']) {
      await page.goto(route);
      await expect(page).toHaveURL(route);
      await expect(
        page.locator(
          route === '/dashboard' ? '.dashboard-shell' : '.lms-shell',
        ),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /access (denied|unavailable)/i }),
      ).toHaveCount(0);
    }
    const enrollment = await db.enrollment.findFirstOrThrow({
      where: { userId: owner.id },
    });
    await page.goto(`/learn/courses/${enrollment.courseId}`);
    await expect(page).toHaveURL(`/learn/courses/${enrollment.courseId}`);
    const enrolledCourse = await db.course.findUniqueOrThrow({
      where: { id: enrollment.courseId },
    });
    await expect(
      page.getByRole('heading', { name: enrolledCourse.title, exact: true }),
    ).toBeVisible();
    // Real same-session revocation check, with auditable local operator and guaranteed restoration.
    roleCommand('revoke');
    revoked = true;
    await page
      .context()
      .addCookies([
        { name: 'role', value: 'ADMIN', url: 'http://127.0.0.1:3000' },
      ]);
    expect(
      (
        await page.request.post('/api/admin/roles?role=ADMIN', {
          data: { role: 'ADMIN', userId: owner.id },
          headers: { origin: 'http://127.0.0.1:3000' },
        })
      ).status(),
    ).toBe(403);
    expect((await page.request.get('/api/admin/overview')).status()).toBe(403);
    for (const route of ['/admin', '/admin-auth/sign-in']) {
      await page.goto(route);
      await expect(page).toHaveURL(route);
      await expect(
        page.getByRole('heading', { name: 'Access denied', exact: true }),
      ).toBeVisible();
      await expect(page.locator('.admin-sidebar')).toHaveCount(0);
    }
    for (const route of ['/dashboard', '/learn']) {
      await page.goto(route);
      await expect(page).toHaveURL(route);
      await expect(page.locator('main')).toBeVisible();
    }
    expect(await studentSnapshot(db, owner.id)).toEqual(before);
    roleCommand('grant');
    revoked = false;
    await page.goto('/admin-auth/sign-in');
    await expect(page).toHaveURL('/admin');
    expect(
      (
        await page.request.post('/api/admin/roles', {
          data: { role: 'ADMIN' },
          headers: { origin: 'http://127.0.0.1:3000' },
        })
      ).status(),
    ).toBe(404);
    await page.getByRole('button', { name: /^Open account menu for / }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/admin-auth\/sign-in/);
    await expect(page.getByLabel('Email address')).toBeVisible();
    expect((await page.request.get('/api/admin/overview')).status()).toBe(401);
    await signIn();
    const after = await studentSnapshot(db, owner.id);
    expect(after).toEqual(before);
    await writeFile(
      'docs/reviews/admin-owner/student-preservation.json',
      JSON.stringify(
        { before, after, unchanged: before.digest === after.digest },
        null,
        2,
      ),
    );
  } finally {
    if (revoked) roleCommand('grant');
    for (const id of sessionIds)
      await clerk.sessions.revokeSession(id).catch(() => {});
    for (const id of tokenIds)
      await clerk.signInTokens.revokeSignInToken(id).catch(() => {});
    await db.$disconnect();
  }
});
