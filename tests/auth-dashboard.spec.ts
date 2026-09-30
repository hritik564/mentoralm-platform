import { test, expect, type Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/nextjs/server';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { dashboardDestination } from '../src/lib/auth/redirects';

const destinations = [
  '/dashboard',
  '/dashboard/courses',
  '/dashboard/resources',
  '/dashboard/support',
  '/dashboard/referral',
  '/dashboard/profile',
];
const labels = [
  'Overview',
  'My Courses',
  'Resources',
  'Support',
  'Referral',
  'Profile',
];
const configured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);
const development =
  process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_');
const review = 'docs/reviews/d1';
mkdirSync(review, { recursive: true });

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function scan(page: Page, include: string) {
  const result = await new AxeBuilder({ page })
    .include(include)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

test.beforeAll(async () => {
  if (development) await clerkSetup();
});

test('redirect policy only accepts the six internal dashboard routes', () => {
  for (const path of destinations)
    expect(dashboardDestination(path)).toBe(path);
  for (const path of [
    'https://evil.example',
    '//evil.example',
    '/dashboard?user=other',
    '/dashboard/../admin',
    [' /dashboard'],
    undefined,
  ]) {
    expect(dashboardDestination(path)).toBe('/dashboard');
  }
});

test('all dashboard routes redirect unauthenticated requests and reject forged client identity', async ({
  request,
}) => {
  for (const path of [...destinations, '/dashboard/unknown']) {
    const response = await request.get(`${path}?userId=not-a-session`, {
      maxRedirects: 0,
      headers: {
        cookie: '__session=forged; mentoralm-user=other',
        'x-user-id': 'other',
      },
    });
    expect([302, 303, 307, 308]).toContain(response.status());
    const location = new URL(
      response.headers().location,
      'http://127.0.0.1:3100',
    );
    expect(location.pathname).toBe('/sign-in');
    expect(location.origin).toBe('http://127.0.0.1:3100');
    expect(location.searchParams.get('redirect_url')).toBe(
      dashboardDestination(path),
    );
    expect(await response.text()).not.toContain('Your learning, in one place.');
  }
});

test('public auth sheet contains focus, switches mode, closes with Escape and restores focus', async ({
  page,
}, info) => {
  if (development) await setupClerkTestingToken({ page });
  await page.goto('/');
  if (info.project.name === 'd1-mobile')
    await page
      .getByRole('button', { name: 'Open navigation', exact: true })
      .click();
  const trigger = page
    .getByRole('button', { name: 'Login / Sign up' })
    .filter({ visible: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: 'One account. A world of possibilities.',
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Close authentication' }),
  ).toBeFocused();
  await dialog
    .getByRole('button', { name: 'Create Account', exact: true })
    .click();
  await expect(
    dialog.getByRole('button', { name: 'Create Account', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  if (configured)
    await expect(dialog.locator('input[name="emailAddress"]')).toBeVisible();
  else
    await expect(
      dialog.getByRole('heading', { name: 'Sign-in is not available yet' }),
    ).toBeVisible();
  await dialog.getByRole('button', { name: 'Login', exact: true }).click();
  if (configured)
    await expect(dialog.locator('input[name="identifier"]')).toBeVisible();
  await scan(page, '.auth-sheet[open]');
  await noOverflow(page);
  await page.screenshot({
    path: `${review}/auth-sheet-${info.project.name}.png`,
  });
  await dialog.getByRole('button', { name: 'Close authentication' }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('real development signup, login, server-protected shell, public avatar, support and logout', async ({
  page,
}, info) => {
  test.skip(
    !development,
    'Requires owner-provided Clerk development keys; production instances are never mutated.',
  );
  test.setTimeout(180000);
  page.setDefaultNavigationTimeout(25000);
  page.setDefaultTimeout(20000);
  const email = `d1-${Date.now()}-${randomBytes(3).toString('hex')}+clerk_test@example.com`;
  const password = `D1!${randomBytes(22).toString('base64url')}a9`;
  const backend = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  await setupClerkTestingToken({ page });
  try {
    console.info('D1: real signup started');
    await page.goto('/sign-up?redirect_url=/dashboard');
    await expect(page.locator('input[name="emailAddress"]')).toBeVisible();
    for (const [name, value] of [
      ['firstName', 'D1'],
      ['lastName', 'Review'],
      ['username', `d1_${Date.now()}`],
      ['emailAddress', email],
      ['password', password],
    ]) {
      const input = page.locator(`input[name="${name}"]`);
      if (await input.isVisible()) await input.fill(value);
    }
    const phone = page.locator('input[name="phoneNumber"]');
    if (await phone.isVisible())
      await phone.fill(
        `+120155501${Math.floor(Math.random() * 100)
          .toString()
          .padStart(2, '0')}`,
      );
    const acceptance = page.locator('input[name="legalAccepted"]');
    if (await acceptance.isVisible()) await acceptance.check();
    await page.getByRole('button', { name: /^Continue$/ }).click();
    const code = page.getByRole('textbox', { name: /verification code/i });
    await expect(code).toBeVisible();
    console.info('D1: initial signup verification');
    await code.pressSequentially('424242');
    // Wait for the second verification screen, rather than typing into a changing OTP field.
    const phoneHeading = page.getByRole('heading', {
      name: 'Verify your phone',
      exact: true,
    });
    await expect
      .poll(
        async () =>
          page.url().includes('/dashboard') || (await phoneHeading.isVisible()),
      )
      .toBe(true);
    if (!page.url().includes('/dashboard')) {
      const resend = page.getByRole('button', { name: /Resend/i });
      await expect(resend).toBeEnabled({ timeout: 40000 });
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes('/prepare_verification') && response.ok(),
          { timeout: 20000 },
        ),
        resend.click(),
      ]);
      await code.fill('');
      await code.pressSequentially('424242');
    }
    await page.waitForURL('**/dashboard');
    console.info('D1: signup reached protected dashboard');
    await expect(
      page.getByRole('heading', { name: /Welcome back/ }),
    ).toBeVisible();
    await noOverflow(page);
    await scan(page, '.dashboard-shell');
    await page.screenshot({
      path: `${review}/dashboard-${info.project.name}.png`,
      fullPage: true,
    });
    const mobile = info.project.name === 'd1-mobile';
    if (mobile) {
      await page
        .getByRole('button', { name: 'Open dashboard navigation' })
        .click();
      await expect(
        page.getByRole('button', { name: 'Close dashboard navigation' }),
      ).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(
        page
          .getByRole('button', { name: 'Log out', exact: true })
          .filter({ visible: true }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', { name: 'Close dashboard navigation' }),
      ).toBeFocused();
      await scan(page, '.dashboard-mobile-navigation[open]');
      await page.screenshot({
        path: `${review}/dashboard-mobile-navigation.png`,
      });
    }
    const nav = page
      .getByRole('navigation', { name: 'Student dashboard' })
      .filter({ visible: true });
    expect(await nav.getByRole('link').allTextContents()).toEqual(labels);
    await expect(nav.getByText('Settings', { exact: true })).toHaveCount(0);
    for (let i = 1; i < destinations.length; i++) {
      await nav.getByRole('link', { name: labels[i], exact: true }).click();
      await page.waitForURL(`**${destinations[i]}`);
      await expect(
        page.getByRole('heading', { name: labels[i], exact: true }),
      ).toBeVisible();
      await noOverflow(page);
      if (mobile)
        await page
          .getByRole('button', { name: 'Open dashboard navigation' })
          .click();
      await expect(
        nav.getByRole('link', { name: labels[i], exact: true }),
      ).toHaveAttribute('aria-current', 'page');
    }
    if (mobile) {
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: 'Open dashboard navigation' }),
      ).toBeFocused();
    }
    console.info('D1: dashboard navigation verified');
    await page.goto('/');
    if (mobile)
      await page
        .getByRole('button', { name: 'Open navigation', exact: true })
        .click();
    await expect(
      page.getByRole('button', { name: 'Login / Sign up' }),
    ).toHaveCount(0);
    const avatar = page
      .getByRole('button', { name: /Open account menu/ })
      .filter({ visible: true });
    await expect(avatar).toBeVisible();
    await page.screenshot({
      path: `${review}/public-logged-in-${info.project.name}.png`,
    });
    await avatar.click();
    const accountNav = page
      .getByRole('navigation', { name: 'Account navigation' })
      .filter({ visible: true });
    expect(await accountNav.locator('a,button').allTextContents()).toEqual([
      'Dashboard',
      'Support',
      'Log out',
    ]);
    await page.screenshot({
      path: `${review}/account-dropdown-${info.project.name}.png`,
    });
    await page.keyboard.press('Escape');
    await expect(avatar).toBeFocused();
    await avatar.click();
    await accountNav
      .getByRole('link', { name: 'Support', exact: true })
      .click();
    await page.waitForURL('**/dashboard/support');
    await expect(
      page.getByRole('heading', { name: 'Support', exact: true }),
    ).toBeVisible();
    if (mobile)
      await page
        .getByRole('button', { name: 'Open dashboard navigation' })
        .click();
    const sessionId = await page.evaluate(() => window.Clerk.session?.id);
    expect(sessionId).toBeTruthy();
    await page
      .getByRole('button', { name: 'Log out', exact: true })
      .filter({ visible: true })
      .click();
    await page.waitForURL('http://127.0.0.1:3100/');
    await expect
      .poll(async () => (await backend.sessions.getSession(sessionId!)).status)
      .not.toBe('active');
    await page.goto('/dashboard');
    await page.waitForURL('**/sign-in?**');
    console.info('D1: dashboard logout verified');
    // A fresh UI login exercises the provider credential flow after signup/logout.
    await page.locator('input[name="identifier"]').fill(email);
    await page.getByRole('button', { name: /^Continue$/ }).click();
    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible();
    await expect(
      page
        .getByRole('button', { name: /Forgot.*password/i })
        .or(page.getByRole('link', { name: /Forgot.*password/i })),
    ).toBeVisible();
    await passwordInput.fill(password);
    await page.getByRole('button', { name: /^Continue$/ }).click();
    if (await code.isVisible()) await code.pressSequentially('424242');
    await page.waitForURL('**/dashboard');
    console.info('D1: password login verified');
    await page.goto('/');
    if (mobile)
      await page
        .getByRole('button', { name: 'Open navigation', exact: true })
        .click();
    await page
      .getByRole('button', { name: /Open account menu/ })
      .filter({ visible: true })
      .click();
    const publicSessionId = await page.evaluate(() => window.Clerk.session?.id);
    expect(publicSessionId).toBeTruthy();
    await page
      .getByRole('navigation', { name: 'Account navigation' })
      .filter({ visible: true })
      .getByRole('button', { name: 'Log out', exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await backend.sessions.getSession(publicSessionId!)).status,
      )
      .not.toBe('active');
    await expect
      .poll(async () => page.evaluate(() => !window.Clerk.session))
      .toBe(true);
    await page.waitForURL('http://127.0.0.1:3100/');
    console.info('D1: public account logout verified');
    await page.goto('/');
    if (mobile)
      await page
        .getByRole('button', { name: 'Open navigation', exact: true })
        .click();
    await expect(
      page
        .getByRole('button', { name: 'Login / Sign up' })
        .filter({ visible: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `${review}/public-logged-out-${info.project.name}.png`,
      timeout: 15000,
    });
  } finally {
    // Delete only this run's exact development test account, never an owner's user.
    const users = await backend.users.getUserList({ emailAddress: [email] });
    for (const user of users.data) await backend.users.deleteUser(user.id);
  }
});
