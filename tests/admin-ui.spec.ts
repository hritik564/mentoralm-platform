import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  accessFor,
  responseFor,
  type Profile,
  type Scenario,
} from './helpers/admin-ui/data';

const repoRoot = resolve(process.env.MENTORALM_REPO_ROOT || process.cwd());
const helpers = join(__dirname, 'helpers/admin-ui');
const output = resolve(
  process.env.MENTORALM_ADMIN_UI_OUTPUT ||
    join(repoRoot, 'docs/reviews/admin-ui'),
);
const origin = 'http://127.0.0.1:3191';
const primaryLabels = [
  'Overview',
  'Marketplace',
  'Learning',
  'Students',
  'People',
  'Inbox',
  'Settings',
];
const screenshots: {
  name: string;
  path: string;
  width: number;
  theme: string;
}[] = [];
const axeResults: { name: string; violations: number }[] = [];
const safety = new WeakMap<
  Page,
  {
    external: string[];
    unexpected: string[];
    mutations: string[];
    errors: string[];
    api: string[];
    apiQueries: string[];
  }
>();
let bundle = '';
let styles = '';

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  execFileSync(process.execPath, [join(helpers, 'build.cjs')], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MENTORALM_REPO_ROOT: repoRoot,
      MENTORALM_ADMIN_UI_OUTPUT: output,
    },
    stdio: 'pipe',
  });
  bundle = await readFile(join(output, 'fixture-bundle.js'), 'utf8');
  const css = await Promise.all(
    [
      'tokens.css',
      'global.css',
      'dashboard.css',
      'dashboard-theme.css',
      'dashboard-features.css',
      'admin.css',
      'admin-academic.css',
      'admin-operational.css',
      'admin-workspaces.css',
      'admin-learning.css',
      'admin-marketplace.css',
    ].map((name) => readFile(join(repoRoot, 'src/styles', name), 'utf8')),
  );
  styles = [
    ...[400, 500, 600, 700, 800].map(
      (weight) =>
        `@font-face{font-family:'DM Sans';font-style:normal;font-weight:${weight};font-display:swap;src:url('/fixture-fonts/dm-sans-latin-${weight}-normal.woff2') format('woff2')}`,
    ),
    ...css,
  ].join('\n');
});

test.afterEach(async ({ page }) => {
  const state = safety.get(page);
  if (!state) return;
  expect(state.external, 'No external request is allowed').toEqual([]);
  expect(state.unexpected, 'Every API/asset request must be explicit').toEqual(
    [],
  );
  expect(state.mutations, 'UI review must not issue mutation requests').toEqual(
    [],
  );
  expect(state.errors, 'No browser runtime exceptions').toEqual([]);
});

test.afterAll(async () => {
  await writeFile(
    join(output, 'capture-manifest.json'),
    JSON.stringify(screenshots, null, 2),
  );
  await writeFile(
    join(output, 'axe-results.json'),
    JSON.stringify(axeResults, null, 2),
  );
});

async function setup(
  page: Page,
  options: {
    profile?: Profile;
    scenario?: Scenario;
    theme?: 'light' | 'dark';
  } = {},
) {
  const profile = options.profile || 'governance';
  const scenario = options.scenario || 'populated';
  const theme = options.theme || 'light';
  const state = {
    external: [] as string[],
    unexpected: [] as string[],
    mutations: [] as string[],
    errors: [] as string[],
    api: [] as string[],
    apiQueries: [] as string[],
  };
  safety.set(page, state);
  page.on('pageerror', (error) => state.errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-17T12:00:00.000Z'));
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      state.external.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }
    if (request.method() !== 'GET') {
      state.mutations.push(`${request.method()} ${url.pathname}`);
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Offline fixture is read-only.' }),
      });
      return;
    }
    if (url.pathname.startsWith('/api/admin/')) {
      state.api.push(url.pathname);
      state.apiQueries.push(`${url.pathname}${url.search}`);
      let data: unknown;
      try {
        data = responseFor(url.pathname, url.searchParams, profile, scenario);
      } catch {
        state.unexpected.push(url.pathname);
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unexpected fixture API request.' }),
        });
        return;
      }
      if (scenario === 'loading')
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
      await route.fulfill({
        status: scenario === 'error' ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify(
          scenario === 'error'
            ? { error: 'Admin data is temporarily unavailable.' }
            : data,
        ),
      });
      return;
    }
    if (url.pathname === '/fixture-bundle.js') {
      await route.fulfill({
        contentType: 'application/javascript',
        body: bundle,
      });
      return;
    }
    if (url.pathname === '/fixture.css') {
      await route.fulfill({ contentType: 'text/css', body: styles });
      return;
    }
    const font =
      /^\/fixture-fonts\/(dm-sans-latin-(?:400|500|600|700|800)-normal\.woff2)$/.exec(
        url.pathname,
      );
    if (font) {
      await route.fulfill({
        contentType: 'font/woff2',
        body: await readFile(
          join(repoRoot, 'node_modules/@fontsource/dm-sans/files', font[1]),
        ),
      });
      return;
    }
    if (
      request.isNavigationRequest() &&
      /^\/admin(?:\/|$)/.test(url.pathname)
    ) {
      const fixture = JSON.stringify({ theme, access: accessFor(profile) })
        .replaceAll('&', '&amp;')
        .replaceAll("'", '&#39;')
        .replaceAll('<', '&lt;');
      await route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MentoraLM Admin — offline UI fixture</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="fixture-root" data-fixture='${fixture}'></div><script src="/fixture-bundle.js"></script></body></html>`,
      });
      return;
    }
    if (url.pathname === '/favicon.ico') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    state.unexpected.push(url.pathname);
    await route.abort('blockedbyclient');
  });
}

async function ready(page: Page, allowAlert = false) {
  await expect(page.locator('#admin-content h1')).toBeVisible();
  await expect(
    page.getByText('Loading workspace…', { exact: true }),
  ).toHaveCount(0);
  if (!allowAlert)
    await expect(page.locator('#admin-content [role="alert"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

function primaryNav(page: Page) {
  return page
    .locator('.admin-sidebar')
    .getByRole('navigation', { name: 'Admin navigation', exact: true });
}

async function assertNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Document must not overflow horizontally',
  ).toBe(true);
}

async function capture(
  page: Page,
  name: string,
  theme: string,
  selector = '.admin-shell',
) {
  await assertNoOverflow(page);
  const result = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(result.violations, name).toEqual([]);
  axeResults.push({ name, violations: result.violations.length });
  await page.screenshot({
    path: join(output, `${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
  screenshots.push({
    name,
    path: page.url().slice(origin.length),
    width: page.viewportSize()!.width,
    theme,
  });
}

test('seven primary destinations and existing creation/navigation workflows', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/admin');
  await ready(page);
  await expect(primaryNav(page).getByRole('link')).toHaveText(primaryLabels);
  await expect(primaryNav(page).locator('[aria-current="page"]')).toHaveText(
    'Overview',
  );
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Morgan');
  for (const [label, href] of [
    ['Create Course', '/admin/courses?create=course'],
    ['Create Batch', '/admin/batches?create=batch'],
    ['Schedule Class', '/admin/learning/classes'],
    ['Publish Recording', '/admin/learning/recordings'],
  ])
    await expect(
      page
        .locator('#admin-content')
        .getByRole('link', { name: new RegExp(label, 'i') })
        .first(),
    ).toHaveAttribute('href', href);
  await page
    .getByRole('link', { name: /Create Course/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/courses\?create=course$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'Create Course', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/courses$/);
  await page
    .getByRole('group', { name: 'Detail sections', exact: true })
    .getByRole('button', { name: 'Programs', exact: true })
    .click();
  await page
    .getByRole('group', { name: 'Detail sections', exact: true })
    .getByRole('button', { name: 'Courses', exact: true })
    .click();
  await ready(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Same-document navigation preserves the mounted component, matching a
  // Next client-side link to the current route with a new create intent.
  await page.evaluate(() => {
    history.pushState({}, '', '/admin/courses?create=course');
    dispatchEvent(new Event('mentoralm-offline-fixture-navigation'));
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'Create Course', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/courses$/);
  await page.goto('/admin');
  await ready(page);
  await page
    .getByRole('link', { name: /Create Batch/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/batches\?create=batch$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/batches$/);
  await page.evaluate(() => {
    history.pushState({}, '', '/admin/batches?create=batch');
    dispatchEvent(new Event('mentoralm-offline-fixture-navigation'));
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'Create Batch', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/batches$/);
});

test('Batch Live Sessions deep links and browser history preserve the selected section', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/admin/batches/fixture_batch_1?tab=sessions');
  await ready(page);
  await expect(
    page.getByRole('heading', {
      name: 'AI Foundations · November',
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  const sections = page.getByRole('group', {
    name: 'Detail sections',
    exact: true,
  });
  const liveSessions = sections.getByRole('button', {
    name: 'Live Sessions',
    exact: true,
  });
  const overview = sections.getByRole('button', {
    name: 'Overview',
    exact: true,
  });
  await expect(liveSessions).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('heading', {
      name: 'Introduction to applied AI',
      exact: true,
    }),
  ).toBeVisible();
  await capture(page, '1440-batch-live-sessions-deeplink-light', 'light');
  await overview.click();
  await expect(page).toHaveURL(
    /\/admin\/batches\/fixture_batch_1\?tab=overview$/,
  );
  await expect(overview).toHaveAttribute('aria-pressed', 'true');
  await expect(liveSessions).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('heading', { name: 'Batch overview', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(
    /\/admin\/batches\/fixture_batch_1\?tab=sessions$/,
  );
  await expect(liveSessions).toHaveAttribute('aria-pressed', 'true');
  await expect(overview).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('heading', {
      name: 'Introduction to applied AI',
      exact: true,
    }),
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(
    /\/admin\/batches\/fixture_batch_1\?tab=overview$/,
  );
  await expect(overview).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('heading', { name: 'Batch overview', exact: true }),
  ).toBeVisible();
  expect(safety.get(page)!.api).toContain('/api/admin/batches/fixture_batch_1');
});

test('Batch section query values select the matching existing section', async ({
  page,
}) => {
  await setup(page);
  for (const [query, label, heading] of [
    ['overview', 'Overview', 'Batch overview'],
    ['students', 'Students', 'Batch students'],
    ['instructors', 'Instructors', 'Assigned instructors'],
    ['courses', 'Courses', 'Learning scope'],
    ['sessions', 'Live Sessions', 'Live Sessions'],
    ['unrecognized', 'Overview', 'Batch overview'],
  ]) {
    await page.goto(`/admin/batches/fixture_batch_1?tab=${query}`);
    await ready(page);
    await expect(
      page
        .getByRole('group', { name: 'Detail sections', exact: true })
        .getByRole('button', { name: label, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
  }
});

test('Learning exposes four primary areas, three creation actions and compact attention', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/admin/learning');
  await ready(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Learning', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#admin-content')).toContainText(
    'Manage courses, batches, live classes and recordings.',
  );
  const areas = page.locator('section[aria-label="Learning areas"]');
  await expect(areas.getByRole('heading', { level: 2 })).toHaveText([
    'Courses',
    'Batches',
    'Live Classes',
    'Recordings',
  ]);
  await expect(areas.getByRole('link')).toHaveCount(4);
  await expect(areas.getByRole('link', { name: /Marketplace/ })).toHaveCount(0);
  const actions = page.locator('section[aria-label="Quick actions"]');
  await expect(actions.getByRole('link')).toHaveCount(3);
  for (const [label, href] of [
    ['Create Course', '/admin/courses?create=course'],
    ['Create Batch', '/admin/batches?create=batch'],
    ['Schedule Class', '/admin/learning/classes'],
  ])
    await expect(
      actions.getByRole('link', { name: new RegExp(label) }),
    ).toHaveAttribute('href', href);
  await expect(
    page.getByRole('heading', { name: 'Needs Attention', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('#admin-content a[href="/admin/submissions"]').first(),
  ).toBeVisible();
  for (const path of [
    '/admin/courses',
    '/admin/batches',
    '/admin/learning/classes',
    '/admin/learning/recordings',
  ]) {
    await page.goto(path);
    await ready(page);
    await expect(
      page
        .getByRole('navigation', { name: 'Learning workspace', exact: true })
        .getByRole('link'),
    ).toHaveText(['Courses', 'Batches', 'Live Classes', 'Recordings']);
  }
});

test('Marketplace is a separate permission-scoped Admin domain on every retained route', async ({
  page,
}) => {
  await setup(page, { profile: 'marketplace' });
  for (const path of [
    '/admin/marketplace',
    '/admin/marketplace/new',
    '/admin/marketplace/fixture_offering_1',
  ]) {
    await page.goto(path);
    await ready(page);
    await expect(primaryNav(page).getByRole('link')).toHaveText([
      'Overview',
      'Marketplace',
    ]);
    await expect(primaryNav(page).locator('[aria-current="page"]')).toHaveText(
      'Marketplace',
    );
    await expect(
      primaryNav(page).getByRole('link', { name: 'Marketplace', exact: true }),
    ).toHaveAttribute('href', '/admin/marketplace');
    await expect(
      page
        .getByRole('navigation', { name: 'Marketplace workspace', exact: true })
        .getByRole('link'),
    ).toHaveText(['Offerings']);
  }
  expect(safety.get(page)!.api).toEqual([]);
});

test('Marketplace Price accepts human currency amounts and previews currency-specific precision', async ({
  page,
}) => {
  await setup(page, { profile: 'marketplace' });
  await page.goto('/admin/marketplace/new');
  await ready(page);
  const price = page.getByRole('textbox', { name: 'Price', exact: true });
  const currency = page.getByRole('textbox', { name: 'Currency', exact: true });
  const preview = page.locator('output[aria-label="Price preview"]');
  await expect(preview).toHaveText('To be announced');
  await price.fill('15000');
  await expect(preview).toHaveText('₹15,000');
  await price.fill('15000.50');
  await expect(preview).toHaveText('₹15,000.50');
  await price.fill('0');
  await expect(preview).toHaveText('₹0');
  await price.fill('1.001');
  await expect(preview).toHaveText('Use at most 2 decimal places for INR.');
  await currency.fill('JPY');
  await expect(preview).toHaveText('Enter a whole-number price for JPY.');
  await price.fill('15000');
  await expect(preview).toContainText('15,000');
  await currency.fill('KWD');
  await price.fill('0.001');
  await expect(preview).toContainText('0.001');
  await price.fill('-1');
  await expect(preview).toContainText('Enter a nonnegative price');
  await price.fill('');
  await expect(preview).toHaveText('To be announced');
  await expect(page.getByText(/minor units|paise|cents/i)).toHaveCount(0);
  expect(safety.get(page)!.api).toEqual([]);
});

test('empty Learning attention shows its honest caught-up state', async ({
  page,
}) => {
  await setup(page, { scenario: 'empty' });
  await page.goto('/admin/learning');
  await ready(page);
  await expect(page.locator('#admin-content')).toContainText(
    "You're all caught up.",
  );
  await expect(
    page.getByRole('heading', { name: 'AI Foundations', exact: true }),
  ).toHaveCount(0);
});

test('Course sections retain curriculum and scope existing review and certificate destinations', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/admin/courses/fixture_course_1');
  await ready(page);
  const sections = page.getByRole('group', {
    name: 'Course sections',
    exact: true,
  });
  await expect(sections.getByRole('button')).toHaveText([
    'Overview',
    'Curriculum',
    'Batches',
    'Classes',
    'Assignments',
    'Assessments',
    'Resources',
    'Certificates',
  ]);
  for (const [key, label, heading] of [
    ['curriculum', 'Curriculum', 'Getting started'],
    ['batches', 'Batches', 'Compatible batches'],
    ['classes', 'Classes', 'Course classes'],
    ['assignments', 'Assignments', 'Course assignments'],
    ['assessments', 'Assessments', 'Course assessments'],
    ['resources', 'Resources', 'Course resources'],
    ['certificates', 'Certificates', 'Course certificates'],
    ['overview', 'Overview', 'Course overview'],
  ]) {
    await sections.getByRole('button', { name: label, exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/courses/fixture_course_1\\?tab=${key}$`),
    );
    await expect(
      sections.getByRole('button', { name: label, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
  }
  for (const [tab, label, path, heading] of [
    ['assignments', 'Review submissions', 'submissions', 'Assignment Review'],
    ['assessments', 'Review responses', 'attempts', 'Quiz / Assessment Review'],
    [
      'certificates',
      'Open Course Certificates',
      'certificates',
      'Certificates',
    ],
  ]) {
    await page.goto(`/admin/courses/fixture_course_1?tab=${tab}`);
    await ready(page);
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/${path}\\?course=fixture_course_1$`),
    );
    await ready(page);
    await expect(
      page.getByRole('heading', { level: 1, name: heading, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Course filter', exact: true }),
    ).toHaveValue('fixture_course_1');
    expect(
      safety.get(page)!.apiQueries.some((request) => {
        const url = new URL(request, origin);
        return (
          url.pathname === `/api/admin/operations/${path}` &&
          url.searchParams.get('course') === 'fixture_course_1'
        );
      }),
    ).toBe(true);
  }
  await page.goto('/admin/courses/fixture_course_1?tab=classes');
  await ready(page);
  await expect(
    page.getByRole('link', { name: 'Course attendance', exact: true }),
  ).toHaveAttribute('href', '/admin/attendance?course=fixture_course_1');
  await page.goto('/admin/courses/fixture_course_1?tab=batches');
  await ready(page);
  await page.getByRole('link', { name: 'Open Batch →', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/batches\/fixture_batch_1$/);
  await ready(page);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'AI Foundations · November',
      exact: true,
    }),
  ).toBeVisible();
});

test('Course resource selection reuses the item editor and browser history', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/admin/courses/fixture_course_1?tab=resources');
  await ready(page);
  await page
    .getByRole('button', { name: 'Open resource', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'RESOURCE editor', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Learning item title', exact: true }),
  ).toHaveValue('AI reference guide');
  await expect(page).toHaveURL(
    /tab=resources&section=fixture_section_1&item=fixture_resource_1$/,
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/fixture_course_1\?tab=resources$/);
  await page.goBack();
  await expect(
    page.getByRole('dialog', { name: 'RESOURCE editor', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Course resources', exact: true }),
  ).toBeVisible();
});

test('Batch contextual Attendance, Assignments and Recordings reuse existing operations', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/admin/batches/fixture_batch_1?tab=attendance');
  await ready(page);
  const sections = page.getByRole('group', {
    name: 'Detail sections',
    exact: true,
  });
  await expect(
    sections.getByRole('button', { name: 'Attendance', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('a[href="/admin/attendance/fixture_session_1"]'),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Open Batch Attendance', exact: true })
    .click();
  await ready(page);
  await expect(page).toHaveURL(/\/admin\/attendance\?batch=fixture_batch_1$/);
  await expect(
    page.getByRole('combobox', { name: 'Batch filter', exact: true }),
  ).toHaveValue('fixture_batch_1');
  expect(
    safety.get(page)!.apiQueries.some((request) => {
      const url = new URL(request, origin);
      return (
        url.pathname === '/api/admin/operations/attendance' &&
        url.searchParams.get('batch') === 'fixture_batch_1'
      );
    }),
  ).toBe(true);
  await page.goto('/admin/batches/fixture_batch_1?tab=assignments');
  await ready(page);
  await expect(
    page.getByRole('link', {
      name: 'Review Course submissions →',
      exact: true,
    }),
  ).toHaveAttribute('href', '/admin/submissions?course=fixture_course_1');
  await page
    .getByRole('link', { name: 'Open Course Assignments', exact: true })
    .click();
  await ready(page);
  await expect(page).toHaveURL(
    /\/admin\/courses\/fixture_course_1\?tab=assignments$/,
  );
  await expect(
    page.getByText('Practical AI assignment', { exact: true }),
  ).toBeVisible();
  await page.goto(
    '/admin/batches/fixture_batch_1?tab=recordings&session=fixture_session_3',
  );
  await ready(page);
  await expect(
    page
      .getByRole('group', { name: 'Detail sections', exact: true })
      .getByRole('button', { name: 'Recordings', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('heading', { name: 'Ready recording class', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Publish unavailable', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Upload unavailable', exact: true }),
  ).toBeDisabled();
});

test('Live Classes groups existing sessions and opens the same Batch scheduling workflow', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/admin/learning/classes');
  await ready(page);
  await page.getByRole('link', { name: 'View classes →', exact: true }).click();
  await expect(page).toHaveURL(
    /\/admin\/learning\/classes\?batch=fixture_batch_1$/,
  );
  await ready(page);
  for (const name of ['Today', 'Upcoming', 'Past'])
    await expect(
      page.getByRole('heading', { name, exact: true }),
    ).toBeVisible();
  for (const [group, title] of [
    ['Today', 'Introduction to applied AI'],
    ['Upcoming', 'Upcoming AI workshop'],
    ['Past', 'Ready recording class'],
  ])
    await expect(
      page
        .getByRole('region', { name: group, exact: true })
        .getByText(title, { exact: true }),
    ).toBeVisible();
  expect(safety.get(page)!.api).toContain('/api/admin/batches/fixture_batch_1');
  const schedule = page
    .locator('#admin-content')
    .getByRole('link', { name: /Schedule Class/i })
    .first();
  await expect(schedule).toHaveAttribute(
    'href',
    '/admin/batches/fixture_batch_1?tab=sessions&create=session',
  );
  await schedule.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(
    /\/admin\/batches\/fixture_batch_1\?tab=sessions$/,
  );
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test('Recordings groups actual metadata and preserves unavailable publication controls', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/admin/learning/recordings');
  await ready(page);
  await page
    .getByRole('link', { name: 'View recordings →', exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/admin\/learning\/recordings\?batch=fixture_batch_1$/,
  );
  await ready(page);
  for (const name of [
    'Needs Publishing',
    'Published',
    'Processing / Unavailable',
  ])
    await expect(
      page.getByRole('heading', { name, exact: true }),
    ).toBeVisible();
  for (const [group, title] of [
    ['Needs Publishing', 'Ready recording class'],
    ['Published', 'Published recording class'],
    ['Processing / Unavailable', 'Processing recording class'],
  ])
    await expect(
      page
        .getByRole('region', { name: group, exact: true })
        .getByText(title, { exact: true }),
    ).toBeVisible();
  await expect(page.locator('#admin-content')).toContainText(
    /not configured|unavailable/i,
  );
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(
    page
      .locator('#admin-content')
      .getByRole('button', { name: /^Upload|^Publish|^Save/i }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(
        'a[href="/admin/batches/fixture_batch_1?tab=recordings&session=fixture_session_3"]',
      )
      .first(),
  ).toBeVisible();
});

test('academics-only scope retains Courses without Marketplace and excludes Batch and certificate controls', async ({
  page,
}) => {
  await setup(page, { profile: 'academics' });
  await page.goto('/admin/learning');
  await ready(page);
  const areas = page.locator('section[aria-label="Learning areas"]');
  await expect(areas.getByRole('heading', { level: 2 })).toHaveText([
    'Courses',
  ]);
  await expect(areas.getByRole('link', { name: /Marketplace/ })).toHaveCount(0);
  await expect(
    page.locator('section[aria-label="Quick actions"]').getByRole('link'),
  ).toHaveCount(1);
  await page.goto('/admin/courses/fixture_course_1');
  await ready(page);
  await expect(
    page
      .getByRole('group', { name: 'Course sections', exact: true })
      .getByRole('button', { name: 'Certificates', exact: true }),
  ).toHaveCount(0);
  await page.goto('/admin/courses/fixture_course_1?tab=classes');
  await ready(page);
  await expect(
    page.getByRole('link', { name: 'Course attendance', exact: true }),
  ).toHaveCount(0);
  await page.goto('/admin/courses/fixture_course_1?tab=batches');
  await ready(page);
  await expect(
    page.getByRole('link', { name: 'Open Batch →', exact: true }),
  ).toHaveCount(0);
  expect(safety.get(page)!.api).not.toContain(
    '/api/admin/batches/fixture_batch_1',
  );
  for (const path of [
    '/admin/marketplace',
    '/admin/marketplace/new',
    '/admin/marketplace/fixture_offering_1',
  ]) {
    await page.goto(path);
    await ready(page);
    await expect(
      page.getByRole('heading', { name: 'Access unavailable', exact: true }),
    ).toBeVisible();
    await expect(
      primaryNav(page).getByRole('link', { name: 'Marketplace', exact: true }),
    ).toHaveCount(0);
  }
  expect(
    safety
      .get(page)!
      .api.some((path) => path.startsWith('/api/admin/marketplace')),
  ).toBe(false);
});

test('batches-only scope retains session tools and hides Attendance and Assignment tabs', async ({
  page,
}) => {
  await setup(page, { profile: 'batches' });
  await page.goto('/admin/learning');
  await ready(page);
  await expect(
    page
      .locator('section[aria-label="Learning areas"]')
      .getByRole('heading', { level: 2 }),
  ).toHaveText(['Batches', 'Live Classes', 'Recordings']);
  await expect(
    page.locator('section[aria-label="Quick actions"]').getByRole('link'),
  ).toHaveCount(2);
  await page.goto('/admin/batches/fixture_batch_1');
  await ready(page);
  const sections = page.getByRole('group', {
    name: 'Detail sections',
    exact: true,
  });
  await expect(
    sections.getByRole('button', { name: 'Attendance', exact: true }),
  ).toHaveCount(0);
  await expect(
    sections.getByRole('button', { name: 'Assignments', exact: true }),
  ).toHaveCount(0);
  await expect(
    sections.getByRole('button', { name: 'Recordings', exact: true }),
  ).toBeVisible();
  expect(safety.get(page)!.api).not.toContain(
    '/api/admin/academic/courses/fixture_course_1',
  );
  for (const path of [
    '/admin/marketplace',
    '/admin/marketplace/new',
    '/admin/marketplace/fixture_offering_1',
  ]) {
    await page.goto(path);
    await ready(page);
    await expect(
      page.getByRole('heading', { name: 'Access unavailable', exact: true }),
    ).toBeVisible();
    await expect(primaryNav(page).locator('[aria-current="page"]')).toHaveCount(
      0,
    );
    await expect(
      page.locator('#admin-content a[href="/admin/marketplace"]'),
    ).toHaveCount(0);
  }
  expect(
    safety
      .get(page)!
      .api.some((path) => path.startsWith('/api/admin/marketplace')),
  ).toBe(false);
});

for (const [profile, context, choice, action, destination] of [
  [
    'attendance',
    'Batch',
    'fixture_batch_1',
    'Open context Attendance',
    '/admin/attendance?batch=fixture_batch_1',
  ],
  [
    'certificates',
    'Course',
    'fixture_course_1',
    'Open Course Certificates',
    '/admin/certificates?course=fixture_course_1',
  ],
] as const)
  test(`${profile}-only scope retains contextual access without broader Learning controls`, async ({
    page,
  }) => {
    await setup(page, { profile });
    await page.goto('/admin/learning');
    await ready(page);
    await expect(primaryNav(page).getByRole('link')).toHaveText([
      'Overview',
      'Learning',
    ]);
    await expect(
      page.locator('section[aria-label="Learning areas"]').getByRole('link'),
    ).toHaveCount(0);
    await expect(
      page.locator('section[aria-label="Quick actions"]').getByRole('link'),
    ).toHaveCount(0);
    await page
      .getByRole('combobox', { name: context, exact: true })
      .selectOption(choice);
    await page.getByRole('link', { name: action, exact: true }).click();
    await ready(page);
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      destination,
    );
    await expect(
      page.getByRole('combobox', { name: `${context} filter`, exact: true }),
    ).toHaveValue(choice);
    expect(
      safety
        .get(page)!
        .api.some(
          (path) =>
            path.startsWith('/api/admin/academic/') ||
            path === '/api/admin/batches',
        ),
    ).toBe(false);
  });

test('legacy destinations and descendants keep the correct active workflow', async ({
  page,
}) => {
  await setup(page);
  const mappings = [
    ['Marketplace', 'marketplace'],
    ['Marketplace', 'marketplace/new'],
    ['Marketplace', 'marketplace/fixture_offering_1'],
    ['Learning', 'courses'],
    ['Learning', 'courses/fixture_course_1'],
    ['Learning', 'batches'],
    ['Learning', 'batches/fixture_batch_1'],
    ['Learning', 'attendance'],
    ['Learning', 'attendance/fixture_session_1'],
    ['Learning', 'assessments'],
    ['Learning', 'assignments'],
    ['Learning', 'submissions/fixture_submission_1'],
    ['Learning', 'attempts/fixture_attempt_1'],
    ['Learning', 'question-banks/fixture_bank_1'],
    ['Learning', 'certificates'],
    ['Students', 'students'],
    ['Students', 'students/fixture_student_1'],
    ['Students', 'referrals'],
    ['People', 'people'],
    ['People', 'instructors'],
    ['People', 'users/fixture_user_1'],
    ['Inbox', 'inbox'],
    ['Inbox', 'support/fixture_ticket_1'],
    ['Inbox', 'discussions'],
    ['Inbox', 'communications/new'],
    ['Settings', 'settings'],
    ['Settings', 'audit'],
  ];
  for (const [group, path] of mappings) {
    await page.goto(`/admin/${path}`);
    await ready(page);
    await expect(primaryNav(page).locator('[aria-current="page"]')).toHaveText(
      group,
    );
  }
});

test('workspace destinations retain authorized operational links and Student IDs', async ({
  page,
}) => {
  await setup(page);
  for (const [workspace, children] of [
    [
      '/admin/learning',
      [
        '/admin/courses',
        '/admin/batches',
        '/admin/learning/classes',
        '/admin/learning/recordings',
      ],
    ],
    ['/admin/people', ['/admin/instructors', '/admin/users']],
    [
      '/admin/inbox',
      ['/admin/support', '/admin/discussions', '/admin/communications'],
    ],
    ['/admin/settings', ['/admin/audit']],
  ] as const) {
    await page.goto(workspace);
    await ready(page);
    for (const href of children)
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
  }
  await page.goto('/admin/students');
  await ready(page);
  await expect(
    page.getByRole('cell', { name: 'ST-2026-000001', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#admin-content')).not.toContainText('MLM-STU');
  await page
    .getByRole('textbox', { name: 'Search students' })
    .fill('ST-2026-000002');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(
    page.getByRole('cell', { name: 'ST-2026-000002', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'ST-2026-000001', exact: true }),
  ).toHaveCount(0);
});

test('unconfigured recordings and empty Overview remain honest and actionable', async ({
  page,
}) => {
  await setup(page, { scenario: 'empty' });
  await page.goto('/admin');
  await ready(page);
  await expect(page.locator('#admin-content')).toContainText(
    /No live classes scheduled today/i,
  );
  await expect(page.getByText('AI Foundations', { exact: true })).toHaveCount(
    0,
  );
  await capture(page, '1440-overview-empty-light', 'light');
  await page.goto('/admin/learning/recordings');
  await ready(page);
  await expect(page.locator('#admin-content')).toContainText(
    /not configured|coming soon|no recordings/i,
  );
  await expect(
    page
      .locator('#admin-content')
      .getByRole('button', { name: /upload|publish|save/i }),
  ).toHaveCount(0);
  await capture(page, '1440-recordings-empty-light', 'light');
});

test('data errors expose retry without fabricated data', async ({ page }) => {
  await setup(page, { scenario: 'error' });
  await page.goto('/admin');
  await ready(page, true);
  await expect(
    page.locator('#admin-content [role="alert"]').first(),
  ).toContainText('Admin data is temporarily unavailable.');
  await expect(
    page.getByRole('button', { name: 'Try again' }).first(),
  ).toBeVisible();
  await expect(page.getByText('AI Foundations', { exact: true })).toHaveCount(
    0,
  );
  await capture(page, '1440-overview-error-light', 'light');
});

test('loading state resolves using fixture data', async ({ page }) => {
  await setup(page, { scenario: 'loading' });
  await page.goto('/admin');
  await expect(
    page.getByText('Loading workspace…', { exact: true }).first(),
  ).toBeVisible();
  await ready(page);
  await expect(page.locator('#admin-content')).toContainText('AI Foundations');
});

test('Support-only admin sees Inbox and does not request unrelated data', async ({
  page,
}) => {
  await setup(page, { profile: 'support' });
  await page.goto('/admin');
  await ready(page);
  await expect(primaryNav(page).getByRole('link')).toHaveText([
    'Overview',
    'Inbox',
  ]);
  await expect(page.locator('#admin-content')).not.toContainText(
    'AI Foundations',
  );
  await page.goto('/admin/inbox');
  await ready(page);
  await expect(page.locator('a[href="/admin/support"]').first()).toBeVisible();
  await expect(
    page.locator('#admin-content a[href="/admin/discussions"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('#admin-content a[href="/admin/communications"]'),
  ).toHaveCount(0);
  expect(
    safety
      .get(page)!
      .api.every((path) =>
        ['/api/admin/overview', '/api/admin/operations/overview'].includes(
          path,
        ),
      ),
  ).toBe(true);
  await capture(page, '1440-inbox-scoped-light', 'light');
});

for (const [profile, group, destination] of [
  ['audit', 'Settings', '/admin/audit'],
  ['referrals', 'Students', '/admin/referrals'],
] as const)
  test(`${profile}-only admin retains access through ${group}`, async ({
    page,
  }) => {
    await setup(page, { profile });
    await page.goto('/admin');
    await ready(page);
    await expect(primaryNav(page).getByRole('link')).toHaveText([
      'Overview',
      group,
    ]);
    await primaryNav(page)
      .getByRole('link', { name: group, exact: true })
      .click();
    await ready(page);
    if (new URL(page.url()).pathname !== destination) {
      await page.locator(`a[href="${destination}"]`).first().click();
      await ready(page);
    }
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await expect(
      page.getByRole('heading', { name: 'Access unavailable', exact: true }),
    ).toHaveCount(0);
  });

test('empty policy preserves the no-permissions surface and performs no API reads', async ({
  page,
}) => {
  await setup(page, { profile: 'none' });
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'No permissions assigned', exact: true }),
  ).toBeVisible();
  expect(safety.get(page)!.api).toEqual([]);
  await capture(page, '1440-no-permissions-light', 'light');
});

test('mobile drawer contains focus, restores trigger on Escape, and closes after navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto('/admin');
  await ready(page);
  const trigger = page.getByRole('button', {
    name: 'Open Admin navigation',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await expect(
    drawer
      .getByRole('navigation', { name: 'Admin navigation', exact: true })
      .getByRole('link'),
  ).toHaveText(primaryLabels);
  await expect(drawer.locator(':focus')).toHaveCount(1);
  const controls = drawer.locator('a[href],button:not([disabled])');
  await controls.last().focus();
  await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  await capture(page, '390-navigation-drawer-light', 'light', 'dialog[open]');
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page
    .getByRole('dialog')
    .getByRole('link', { name: 'Learning', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/learning$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await ready(page);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of theme === 'light'
    ? [1440, 1024, 820, 390, 320]
    : [1440, 390]) {
    test(`${width}px ${theme} workflow pages render without overflow or axe violations`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await setup(page, { theme });
      for (const [name, path] of [
        ['overview', '/admin'],
        ['learning', '/admin/learning'],
        ['learning-course', '/admin/courses/fixture_course_1'],
        ['learning-classes', '/admin/learning/classes?batch=fixture_batch_1'],
        [
          'learning-recordings',
          '/admin/learning/recordings?batch=fixture_batch_1',
        ],
        ['students', '/admin/students'],
        ['people', '/admin/people'],
        ['inbox', '/admin/inbox'],
        ['settings', '/admin/settings'],
      ]) {
        await page.goto(path);
        await ready(page);
        await expect(page.locator('.admin-shell')).toHaveAttribute(
          'data-admin-theme',
          theme,
        );
        await capture(page, `${width}-${name}-${theme}`, theme);
      }
    });
  }
}

for (const width of [1440, 390])
  test(`${width}px contextual Learning tools retain accessible layouts`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    for (const [name, path] of [
      ['course-curriculum', '/admin/courses/fixture_course_1?tab=curriculum'],
      ['course-assignments', '/admin/courses/fixture_course_1?tab=assignments'],
      ['batch-attendance', '/admin/batches/fixture_batch_1?tab=attendance'],
      [
        'batch-recordings',
        '/admin/batches/fixture_batch_1?tab=recordings&session=fixture_session_3',
      ],
    ]) {
      await page.goto(path);
      await ready(page);
      await capture(page, `${width}-learning-${name}-light`, 'light');
    }
  });
