import { legacyAdminPermissions } from '../src/lib/admin/permissions';
import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { testDatabaseUrl } from './helpers/d4-database';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
loadEnvConfig(process.cwd(), true);
test('Admin signed-out and trusted host boundaries', async ({
  page,
  request,
}) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin-auth\/sign-in/);
  await expect(page.getByLabel('Email address')).toBeVisible();
  expect((await request.get('/api/admin/students')).status()).toBe(401);
  const root = await request.get('/', {
    headers: { host: 'admin.mentoralm.com' },
    maxRedirects: 0,
  });
  expect(root.status()).toBe(307);
  expect(root.headers().location).toContain(
    'https://admin.mentoralm.com/sign-in',
  );
  expect(
    (
      await request.get('/api/admin/overview', {
        headers: { host: 'attacker.test' },
      })
    ).status(),
  ).toBe(400);
});
test('Real Admin workflows, persisted role denial, private recording foundation and responsive themes', async ({
  page,
  context,
}) => {
  const db = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: testDatabaseUrl()! },
        { schema: process.env.D4_TEST_SCHEMA! },
      ),
    }),
    clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  if (!/^d4_[a-f0-9]{24}$/.test(process.env.D4_TEST_SCHEMA || ''))
    throw Error('Isolated Test schema required');
  const suffix = randomUUID().slice(0, 8),
    identities: string[] = [],
    actors: string[] = [],
    batches: string[] = [],
    courses: string[] = [];
  async function identity(
    role: 'ADMIN' | 'STUDENT' | 'INSTRUCTOR',
    name: string,
  ) {
    const u = await clerk.users.createUser({
      emailAddress: [
        `a1-${suffix}-${role.toLowerCase()}+clerk_test@example.com`,
      ],
      firstName: name,
      lastName: 'A1 Review',
      skipPasswordRequirement: true,
    });
    identities.push(u.id);
    const actor = await db.user.create({
      data: {
        clerkUserId: u.id,
        role,
        ...(role === 'ADMIN'
          ? {
              adminAuthorization: {
                create: { permissions: legacyAdminPermissions },
              },
            }
          : {}),
        ...(role === 'STUDENT'
          ? { lmsAccessOverride: 'ENABLED' as const }
          : {}),
      },
    });
    actors.push(actor.id);
    return actor;
  }
  async function signIn(id: string) {
    await context.clearCookies();
    await page.goto('/admin-auth/sign-in');
    await page.waitForFunction(
      () =>
        !!(window as unknown as { Clerk?: { loaded: boolean } }).Clerk?.loaded,
    );
    const token = await clerk.signInTokens.createSignInToken({
      userId: id,
      expiresInSeconds: 180,
    });
    await page.evaluate(async (ticket) => {
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
      const a = await c.client.signIn.create({ strategy: 'ticket', ticket });
      await c.setActive({ session: a.createdSessionId });
    }, token.token);
  }
  async function api(
    path: string,
    body?: unknown,
    origin = 'http://127.0.0.1:3000',
  ) {
    return page.evaluate(
      async ({ path, body, origin }) => {
        const r = await fetch(`/api/admin/${path}`, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'content-type': 'application/json', origin },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: r.status, body: await r.json() };
      },
      { path, body, origin },
    );
  }
  try {
    const admin = await identity('ADMIN', 'Operator'),
      student = await identity('STUDENT', `Learner ${suffix}`),
      instructor = await identity('INSTRUCTOR', `Instructor ${suffix}`);
    const course = await db.course.create({
      data: {
        title: `A1 Course ${suffix}`,
        description: 'Admin validation course',
        published: true,
        thumbnailPath: '/images/campus.webp',
        thumbnailAlt: 'Campus',
        publicPath: '/#programs',
      },
    });
    courses.push(course.id);
    const section = await db.section.create({
        data: {
          courseId: course.id,
          title: 'Live learning',
          position: 1,
          published: true,
        },
      }),
      item = await db.learningItem.create({
        data: {
          sectionId: section.id,
          title: 'A1 LIVE_SESSION',
          position: 1,
          type: 'LIVE_SESSION',
          published: true,
        },
      }),
      batch = await db.batch.create({
        data: {
          code: `A1-${suffix.toUpperCase()}`,
          name: `A1 Batch ${suffix}`,
          courseId: course.id,
          status: 'ACTIVE',
          lmsAccessEnabled: true,
        },
      });
    batches.push(batch.id);
    await db.batchMembership.create({
      data: { userId: student.id, batchId: batch.id },
    });
    await db.batchInstructor.create({
      data: { batchId: batch.id, instructorId: instructor.id },
    });
    await db.enrollment.create({
      data: { userId: student.id, courseId: course.id },
    });
    await db.batchSession.create({
      data: {
        batchId: batch.id,
        courseId: course.id,
        itemId: item.id,
        instructorId: instructor.id,
        title: 'A1 Live Session',
        startsAt: new Date('2026-10-02T09:00:00Z'),
        endsAt: new Date('2026-10-02T10:00:00Z'),
      },
    });
    for (const who of [student, instructor]) {
      await signIn(who.clerkUserId);
      await page.goto('/admin');
      await expect(
        page.getByRole('heading', { name: 'Access denied' }),
      ).toBeVisible();
      expect((await api('students')).status).toBe(403);
      expect((await api('batches', { role: 'ADMIN' })).status).toBe(403);
      expect(
        (await api('sessions/forged/recording', { action: 'UPLOAD' })).status,
      ).toBe(403);
    }
    await signIn(admin.clerkUserId);
    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { name: 'Overview', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Students', exact: true }),
    ).toBeVisible();
    const students = await api(
      `students?q=${encodeURIComponent(student.clerkUserId)}`,
    );
    expect(students.status).toBe(200); // Clerk search uses human-facing name/email below.
    const result = await api(
      `students?q=${encodeURIComponent(student.studentId!)}`,
    );
    expect(result.status).toBe(200);
    expect(result.body.total).toBe(1);
    const studentRef = result.body.rows[0].ref;
    const found = await api(`batches?q=A1-${suffix.toUpperCase()}`);
    expect(found.body.total).toBe(1);
    const batchRef = found.body.rows[0].ref;
    const detail = await api(`batches/${batchRef}`),
      sessionRef = detail.body.sessions[0].ref;
    expect(JSON.stringify(detail.body)).not.toContain(instructor.clerkUserId);
    expect(JSON.stringify(result.body)).not.toContain(student.clerkUserId);
    expect(JSON.stringify(result.body)).not.toContain(student.id);
    expect(
      (
        await api(`students/${studentRef}/access`, {
          value: 'ENABLED',
          actorId: admin.id,
        })
      ).status,
    ).toBe(400);
    expect((await api('students/forged')).status).toBe(404);
    expect(
      (await api(`sessions/${sessionRef}/recording`, { action: 'UPLOAD' }))
        .status,
    ).toBe(503);
    const foreign = await page.request.post(
      `/api/admin/students/${studentRef}/access`,
      {
        headers: { origin: 'https://attacker.test' },
        data: { value: 'DISABLED' },
      },
    );
    expect(foreign.status()).toBe(403);
    await page.goto(`/admin/students/${studentRef}`);
    await expect(
      page.getByRole('heading', { name: `Learner ${suffix} A1 Review` }),
    ).toBeVisible();
    await expect(page.getByLabel('Individual LMS override')).toHaveValue(
      'ENABLED',
    );
    page.once('dialog', (d) => d.accept());
    await page.getByLabel('Individual LMS override').selectOption('DISABLED');
    await expect(
      page.getByText('Individual override disables LMS access'),
    ).toBeVisible();
    await page.getByLabel('Individual LMS override').selectOption('INHERIT');
    await expect(
      page.getByText(`${batch.name} Batch access`, { exact: true }),
    ).toBeVisible();
    expect(
      (await api(`batches/${batchRef}/access`, { value: false })).status,
    ).toBe(200);
    expect((await api(`students/${studentRef}`)).body.effective.enabled).toBe(
      false,
    );
    expect(
      (await api(`students/${studentRef}/access`, { value: 'ENABLED' })).status,
    ).toBe(200);
    expect(
      (await api(`batches/${batchRef}/access`, { value: true })).status,
    ).toBe(200);
    expect((await api(`students/${studentRef}`)).body.override).toBe('ENABLED');
    const courseChoices = (await api('choices/courses')).body;
    const courseRef = courseChoices.find(
      (c: { label: string }) => c.label === course.title,
    ).ref;
    expect(
      (
        await api(`students/${studentRef}/enrollments`, {
          courseId: courseRef,
          value: null,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api(`batches/${batchRef}/memberships`, {
          userId: studentRef,
          status: 'INACTIVE',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api(`batches/${batchRef}/memberships`, {
          userId: studentRef,
          status: 'ACTIVE',
        })
      ).status,
    ).toBe(200);
    expect(await db.enrollment.count({ where: { userId: student.id } })).toBe(
      0,
    );
    expect(
      (
        await api(`students/${studentRef}/enrollments`, {
          courseId: courseRef,
          value: 'ENROLLED',
        })
      ).status,
    ).toBe(200);
    await page.goto(`/admin/batches/${batchRef}`);
    await expect(
      page.getByRole('heading', { name: batch.name, exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Live Sessions', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Upload unavailable' }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'Edit session', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('LIVE_SESSION learning item')).not.toHaveValue(
      '',
    );
    await page
      .getByLabel('Title', { exact: true })
      .fill('A1 Live Session Updated');
    await page
      .getByRole('button', { name: 'Save session', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(
      page.getByRole('heading', {
        name: 'A1 Live Session Updated',
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Edit session', exact: true })
      .click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Edit session', exact: true }),
    ).toBeFocused();
    await mkdir('docs/reviews/admin-a1', { recursive: true });
    for (const theme of ['light', 'dark']) {
      await context.addCookies([
        {
          name: 'mentoralm-product-theme',
          value: theme,
          url: 'http://127.0.0.1:3000',
        },
      ]);
      for (const [name, url, width] of [
        ['overview', '/admin', 1440],
        ['students', `/admin/students?q=${student.studentId}`, 1440],
        ['student-detail', `/admin/students/${studentRef}`, 1440],
        ['batch-sessions', `/admin/batches/${batchRef}`, 1440],
        ['students', `/admin/students?q=${student.studentId}`, 820],
        ['batch-detail', `/admin/batches/${batchRef}`, 820],
        ['students', `/admin/students?q=${student.studentId}`, 1024],
        ['student-detail', `/admin/students/${studentRef}`, 390],
      ] as const) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(url);
        await expect(page.locator('.admin-shell')).toHaveAttribute(
          'data-admin-theme',
          theme,
        );
        await expect(page.locator('.admin-state')).toHaveCount(0);
        if (name === 'batch-sessions')
          await page
            .getByRole('button', { name: 'Live Sessions', exact: true })
            .click();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (width === 1440 || width === 820) {
          const axe = await new AxeBuilder({ page }).analyze();
          expect(axe.violations).toEqual([]);
        }
        await page.screenshot({
          path: `docs/reviews/admin-a1/${theme}-${width}-${name}.png`,
          fullPage: true,
        });
      }
    }
    await page
      .getByRole('button', { name: 'Open Admin navigation', exact: true })
      .click();
    await expect(
      page.getByRole('navigation', { name: 'Admin navigation' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Students', exact: true }).click();
    await expect(
      page.getByRole('navigation', { name: 'Admin navigation' }),
    ).toBeHidden();
    expect(
      await db.academicAudit.count({ where: { actorId: admin.id } }),
    ).toBeGreaterThan(8);
    await db.user.update({
      where: { id: admin.id },
      data: { role: 'INSTRUCTOR' },
    });
    expect((await api('overview')).status).toBe(403);
    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { name: 'Access denied' }),
    ).toBeVisible();
    await db.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
    await page.goto('/admin');
    await page.getByRole('button', { name: /Open account menu/ }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/admin-auth\/sign-in/);
  } finally {
    // Immutable audit and all business fixtures are removed only by isolated-schema teardown.
    for (const id of identities) await clerk.users.deleteUser(id);
    await db.$disconnect();
  }
});
