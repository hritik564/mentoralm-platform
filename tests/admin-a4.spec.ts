import { test, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { testDatabaseUrl } from './helpers/d4-database';
import {
  signInTestAccount,
  signOutTestAccount,
  refreshTestSession,
} from './helpers/clerk-session';
import AxeBuilder from '@axe-core/playwright';
const origin = 'http://127.0.0.1:3104';
test('A4 anonymous and untrusted-host governance requests fail closed', async ({
  page,
  request,
}) => {
  for (const area of ['users', 'audit', 'settings', 'instructors'])
    expect((await request.get(`/api/admin/governance/${area}`)).status()).toBe(
      401,
    );
  expect(
    (
      await request.get('/api/admin/governance/users', {
        headers: { host: 'attacker.test' },
      })
    ).status(),
  ).toBe(400);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/admin-auth\/sign-in/);
  await expect(page.getByLabel('Email address')).toBeVisible();
});
test('A4 real Clerk governance, scoped isolation, safe mutations, responsive themes and accessibility', async ({
  page,
  browser,
}) => {
  test.setTimeout(600000);
  const f = JSON.parse(
    await readFile('docs/reviews/admin-a4/fixture.json', 'utf8'),
  ) as {
    schema: string;
    ownerId: string;
    ownerClerkId: string;
    studentId: string;
    studentClerkId: string;
    courseId: string;
    refs: Record<string, string>;
  };
  if (
    f.schema !== process.env.A3_TEST_SCHEMA ||
    !/^d4_[a-f0-9]{24}$/.test(f.schema)
  )
    throw Error('Test schema mismatch');
  const db = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: testDatabaseUrl()! },
        { schema: f.schema },
      ),
    }),
    root = 'docs/reviews/admin-a4',
    axeResults: { capture: string; violations: number }[] = [],
    studentContext = await browser.newContext({ baseURL: origin }),
    studentPage = await studentContext.newPage();
  await mkdir(root, { recursive: true });
  async function api(
    path: string,
    body?: unknown,
    status = 200,
    headers = { origin },
  ) {
    await refreshTestSession(page);
    const response =
      body === undefined
        ? await page.request.get(`/api/admin/${path}`)
        : await page.request.post(`/api/admin/${path}`, {
            data: body,
            headers,
          });
    expect(response.status(), `${path}: ${await response.text()}`).toBe(status);
    return response;
  }
  async function ready() {
    await expect(page.locator('h1')).toBeVisible();
    await expect(
      page.getByText('Loading workspace…', { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('main [role=alert]')).toHaveCount(0);
  }
  async function capture(name: string) {
    await ready();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name,
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .include('#admin-content')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations, name).toEqual([]);
    axeResults.push({ capture: name, violations: result.violations.length });
    await page.screenshot({ path: `${root}/${name}.png`, fullPage: true });
  }
  try {
    await page.goto('/admin-auth/sign-in');
    await signInTestAccount(page, f.ownerClerkId);
    await page.goto('/admin');
    await ready();
    await expect(
      page.getByRole('link', { name: 'Users & Access', exact: true }),
    ).toBeVisible();
    const userRef = f.refs.user;
    await page.goto(`/admin/users/${userRef}`);
    await ready();
    await page.getByRole('button', { name: 'Manage additional roles' }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('combobox', { name: 'Additional role', exact: true })
      .selectOption('ADMIN');
    await dialog
      .getByLabel('Reason', { exact: true })
      .fill('A4 isolated permission regression');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Confirm change' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText('No operational permissions assigned.'),
    ).toBeVisible();
    expect(
      (
        await db.adminAuthorization.findUniqueOrThrow({
          where: { userId: f.studentId },
        })
      ).permissions,
    ).toEqual([]);
    await studentPage.goto('/admin-auth/sign-in');
    await signInTestAccount(studentPage, f.studentClerkId);
    await studentPage.goto('/admin');
    await expect(
      studentPage.getByRole('heading', { name: 'No permissions assigned' }),
    ).toBeVisible();
    for (const area of [
      'students',
      'batches',
      'academic/courses',
      'operations/support',
      'governance/users',
      'governance/audit',
      'governance/settings',
    ]) {
      await refreshTestSession(studentPage);
      expect(
        (await studentPage.request.get(`/api/admin/${area}`)).status(),
        area,
      ).toBe(403);
    }
    await page.getByRole('button', { name: 'Manage Admin policy' }).click();
    await dialog.getByLabel('support manage', { exact: true }).check();
    await dialog
      .getByLabel('Reason', { exact: true })
      .fill('Support-only scoped test');
    await dialog
      .getByText('I confirm this access change.', { exact: true })
      .click();
    await dialog.getByRole('button', { name: 'Confirm change' }).click();
    await expect(dialog).toHaveCount(0);
    await studentPage.goto('/admin');
    await expect(
      studentPage.getByRole('heading', { name: 'Overview', exact: true }),
    ).toBeVisible();
    await expect(
      studentPage.getByRole('heading', { name: 'Open Support', exact: true }),
    ).toBeVisible();
    await expect(
      studentPage.getByRole('link', { name: 'Students', exact: true }),
    ).toHaveCount(0);
    await expect(
      studentPage.getByRole('link', { name: 'Support', exact: true }),
    ).toBeVisible();
    await refreshTestSession(studentPage);
    const over = await studentPage.request.get('/api/admin/overview');
    expect(Object.keys((await over.json()).metrics)).toEqual(['support']);
    await studentPage.goto('/admin/support');
    await expect(
      studentPage.getByRole('heading', { name: 'Support', exact: true }),
    ).toBeVisible();
    await expect(
      studentPage.getByText('Help opening my practice notes', { exact: true }),
    ).toBeVisible();
    await refreshTestSession(studentPage);
    expect(
      (
        await studentPage.request.get(
          `/api/admin/operations/submissions/${f.refs.submissions}`,
        )
      ).status(),
    ).toBe(403);
    const policy = await db.adminAuthorization.findUniqueOrThrow({
      where: { userId: f.studentId },
    });
    await refreshTestSession(studentPage);
    expect(
      (
        await studentPage.request.post(
          `/api/admin/governance/users/${userRef}/policy`,
          {
            data: {
              authority: 'GOVERNANCE',
              permissions: [],
              expectedRevision: policy.revision,
              confirmation: true,
              reason: 'Attempted self-promotion',
            },
            headers: { origin },
          },
        )
      ).status(),
    ).toBe(403);
    await api(
      `governance/users/${userRef}/roles`,
      {
        role: 'ADMIN',
        operation: 'grant',
        expectedState: (await (await api(`governance/users/${userRef}`)).json())
          .state,
        confirmation: true,
        reason: 'Forged actor',
        actorId: f.ownerId,
      },
      400,
    );
    await api(
      `governance/users/${userRef}/policy`,
      {
        authority: 'SCOPED',
        permissions: [],
        expectedRevision: '00000000-0000-4000-8000-000000000000',
        confirmation: true,
        reason: 'Stale mutation',
      },
      409,
    );
    await api(
      `governance/users/${userRef}/policy`,
      {
        authority: 'SCOPED',
        permissions: [],
        expectedRevision: policy.revision,
        confirmation: true,
        reason: 'Wrong origin',
      },
      403,
      { origin: 'https://attacker.test' },
    );
    await refreshTestSession(page);
    expect(
      (
        await page.request.post(
          `api/admin/governance/users/${userRef}/policy`,
          { data: { reason: 'x'.repeat(20000) }, headers: { origin } },
        )
      ).status(),
    ).toBe(400);
    expect(
      (await page.request.delete('/api/admin/governance/audit')).status(),
    ).toBe(405);
    // Revoke is immediate for the same signed-in Student session; no Clerk logout required.
    const detail = await (await api(`governance/users/${userRef}`)).json();
    await api(`governance/users/${userRef}/roles`, {
      role: 'ADMIN',
      operation: 'revoke',
      expectedState: detail.state,
      confirmation: true,
      reason: 'End isolated test grant',
    });
    await studentPage.goto('/admin');
    await expect(
      studentPage.getByRole('heading', { name: 'Access denied', exact: true }),
    ).toBeVisible();
    await refreshTestSession(studentPage);
    expect(
      (await studentPage.request.get('/api/admin/governance/users')).status(),
    ).toBe(403);
    await page.goto('/admin/students');
    await ready();
    const checkbox = page.getByRole('checkbox', {
      name: 'Select A3 Review Student',
      exact: true,
    });
    await checkbox.check();
    await page
      .getByRole('button', { name: 'Change selected LMS access' })
      .click();
    await dialog
      .getByRole('combobox', { name: 'LMS override', exact: true })
      .selectOption('ENABLED');
    await dialog
      .getByLabel('Reason')
      .fill('A4 isolated selected access verification');
    await dialog.getByRole('checkbox').check();
    await dialog
      .getByRole('button', { name: 'Confirm selected change' })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(/1 saved; 0 failed/)).toBeVisible();
    const routes = [
      ['Overview', '/admin'],
      ['Students', '/admin/students'],
      ['Course-Builder', `/admin/courses/${f.refs.course}`],
      ['Attendance', `/admin/attendance/${f.refs.attendance}`],
      ['Support', `/admin/support/${f.refs.support}`],
      ['Users', '/admin/users'],
      ['User-Detail', `/admin/users/${userRef}`],
      ['Audit', '/admin/audit'],
      ['Settings', '/admin/settings'],
      ['Instructors', '/admin/instructors'],
    ] as const;
    for (const theme of ['light', 'dark']) {
      await page
        .context()
        .addCookies([
          { name: 'mentoralm-product-theme', value: theme, url: origin },
        ]);
      for (const width of [1440, 1024, 820, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const [name, path] of routes) {
          await refreshTestSession(page);
          await page.goto(path);
          await capture(`${width}-${name}-${theme}`);
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/admin/users/${userRef}`);
    await ready();
    await page.getByRole('button', { name: 'Manage additional roles' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(':focus')).toHaveCount(1);
    expect(
      (
        await new AxeBuilder({ page })
          .include('dialog[open]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Manage additional roles' }),
    ).toBeFocused();
    await signOutTestAccount(page);
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/admin-auth\/sign-in/);
    await expect(page.getByLabel('Email address')).toBeVisible();
    await signOutTestAccount(studentPage);
    await writeFile(
      `${root}/axe-results.json`,
      JSON.stringify(axeResults, null, 2),
    );
  } finally {
    await studentContext.close();
    await db.$disconnect();
  }
});

test('A4 audit filters intersect and unknown projections never invent a target', async ({
  page,
}) => {
  const f = JSON.parse(
    await readFile('docs/reviews/admin-a4/fixture.json', 'utf8'),
  ) as { ownerClerkId: string; refs: Record<string, string> };
  test.setTimeout(180000);
  await page.goto('/admin-auth/sign-in');
  await signInTestAccount(page, f.ownerClerkId);
  await page.goto('/admin/audit');
  await refreshTestSession(page);
  const response = await page.request.get(
    '/api/admin/governance/audit?category=Support&action=AdditionalRoleChanged',
  );
  expect(response.status()).toBe(200);
  expect((await response.json()).total).toBe(0);
  expect(
    (
      await page.request.get('/api/admin/governance/audit?action=__proto__')
    ).status(),
  ).toBe(400);
  const results: { capture: string; violations: number }[] = [];
  for (const theme of ['light', 'dark']) {
    await page
      .context()
      .addCookies([
        { name: 'mentoralm-product-theme', value: theme, url: origin },
      ]);
    for (const width of [1440, 1024, 820, 390]) {
      await refreshTestSession(page);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/admin/audit');
      await expect(
        page.getByText('Loading workspace…', { exact: true }),
      ).toHaveCount(0);
      await expect(page.locator('main [role=alert]')).toHaveCount(0);
      const result = await new AxeBuilder({ page })
        .include('#admin-content')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const capture = `${width}-Audit-${theme}`;
      await page.screenshot({
        path: `docs/reviews/admin-a4/${capture}.png`,
        fullPage: true,
      });
      results.push({ capture, violations: result.violations.length });
    }
    await refreshTestSession(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/admin/users/${f.refs.user}`);
    const trigger = page.getByRole('button', {
      name: 'Manage additional roles',
    });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const result = await new AxeBuilder({ page })
      .include('dialog[open]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    const capture = `1440-Role-Management-${theme}`;
    await page.screenshot({
      path: `docs/reviews/admin-a4/${capture}.png`,
      fullPage: true,
    });
    results.push({ capture, violations: result.violations.length });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  await writeFile(
    'docs/reviews/admin-a4/axe-audit-dialog-final.json',
    JSON.stringify(results, null, 2),
  );
  await signOutTestAccount(page);
});
