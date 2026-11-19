import { test, expect, type Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { testDatabaseUrl } from './helpers/d4-database';
import { signInTestAccount, refreshTestSession } from './helpers/clerk-session';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const directory = 'docs/reviews/marketplace-m6',
  origin = 'http://127.0.0.1:3113';
let db: PrismaClient;
let fixtures: {
  slug: string;
  courseId: string;
  itemId: string;
  offeringRef: string;
  active: { orderRef: string };
  review: { orderRef: string; deliveryRef: string; courseId: string };
};
const captures: string[] = [];
let axeScans = 0;
function action(input: object) {
  const output = execFileSync(
    process.execPath,
    [
      'node_modules/tsx/dist/cli.mjs',
      'tests/helpers/marketplace-m6-browser-fixtures.ts',
    ],
    {
      env: { ...process.env, NODE_OPTIONS: '--conditions=react-server' },
      input: JSON.stringify(input),
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )
    .toString()
    .trim();
  return JSON.parse(output.split('\n').at(-1)!);
}
test.beforeAll(async () => {
  await clerkSetup();
  const schema = process.env.D4_TEST_SCHEMA;
  if (!schema || !/^d4_[a-f0-9]{24}$/.test(schema))
    throw Error('Isolated Test schema required');
  db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl()! }, { schema }),
  });
  fixtures = action({ action: 'seed' });
});
test.afterAll(async () => {
  writeFileSync(
    `${directory}/capture-manifest.json`,
    JSON.stringify(
      {
        captures,
        axeScans,
        axeViolations: 0,
        widths: [1672, 1440, 1024, 820, 390, 320],
      },
      null,
      2,
    ) + '\n',
  );
  await db?.$disconnect();
  const file = `${directory}/mock-provider-${process.env.D4_TEST_SCHEMA}.json`;
  if (existsSync(file)) unlinkSync(file);
});
async function capture(page: Page, name: string, axe = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    name + ' overflow',
  ).toBe(true);
  if (axe) {
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations,
      name + ' axe',
    ).toEqual([]);
    axeScans++;
  }
  await page.screenshot({
    path: `${directory}/${name}.png`,
    fullPage: true,
    mask: [
      page.locator('.account-avatar'),
      page.locator('.account-menu'),
      page.locator('.enrollment-account'),
      page.locator('.dashboard-account'),
      page.locator('.dashboard-user'),
      page.locator('.dashboard-welcome h1'),
      page.locator('.lms-account'),
      page.locator('.lms-profile-person'),
      page.locator('.commerce-table td:nth-child(2)'),
      page.locator('#fullName'),
      page.locator('.commerce-admin-details').first().locator('dd').first(),
    ],
  });
  captures.push(name + '.png');
}
async function widths(page: Page, name: string) {
  for (const width of [1672, 1440, 1024, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await capture(page, `${width}-${name}`, width === 1440 || width === 390);
  }
}

test('M6 full browser purchase with native Checkout component and injected PSP, six-width public/private/Admin QA', async ({
  page,
  context,
}) => {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }),
    owners = await clerk.users.getUserList({
      emailAddress: ['arcaderobo3@gmail.com'],
      limit: 2,
    });
  expect(owners.data).toHaveLength(1);
  let sessionId: string | null = null;
  let orderRef = '';
  try {
    await setupClerkTestingToken({ page });
    await page.goto('/courses');
    await expect(
      page.getByRole('heading', { name: 'Courses & Programs' }),
    ).toBeVisible();
    await widths(page, 'catalogue');
    await page.goto(`/courses/${fixtures.slug}`);
    await expect(
      page.getByRole('button', { name: 'Enroll Now', exact: true }).first(),
    ).toBeVisible();
    const publicHtml = await context.request.get(`/courses/${fixtures.slug}`);
    expect(publicHtml.status()).toBe(200);
    const publicPayload = await publicHtml.text();
    const rsc = await context.request.get(`/courses/${fixtures.slug}`, {
      headers: { RSC: '1' },
    });
    const rscPayload = await rsc.text();
    for (const privateValue of [
      fixtures.courseId,
      fixtures.active.orderRef,
      fixtures.review.deliveryRef,
    ]) {
      expect(publicPayload).not.toContain(privateValue);
      expect(rscPayload).not.toContain(privateValue);
    }
    // No robots tag is the normal indexable default; do not wait for a nonexistent element.
    expect(
      await page
        .locator('head meta[name="robots"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute('content') || '').join(' '),
        ),
    ).not.toContain('noindex');
    await widths(page, 'program');
    await page
      .getByRole('button', { name: 'Enroll Now', exact: true })
      .first()
      .click();
    await page.waitForURL('**/sign-in?redirect_url=**');
    const target = new URL(page.url()).searchParams.get('redirect_url')!;
    expect(target).toMatch(/^\/enroll\/[A-Za-z0-9_-]{43}$/);
    const ref = target.split('/')[2];
    await signInTestAccount(page, owners.data[0].id);
    await refreshTestSession(page);
    sessionId = await page.evaluate(
      () =>
        (window as unknown as { Clerk: { session: { id: string } } }).Clerk
          .session.id,
    );
    await page.goto(`/sign-in?redirect_url=${encodeURIComponent(target)}`);
    await page.waitForURL(`**${target}`);
    await expect(
      page.getByRole('button', { name: 'Save & continue' }),
    ).toBeEnabled();
    await page
      .getByLabel('Full name', { exact: true })
      .fill('Synthetic M6 Learner');
    await widths(page, 'onboarding');
    // Keyboard activates validation and preserves the focused error summary.
    await page.getByRole('button', { name: 'Save & continue' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.enrollment-error-summary')).toBeFocused();
    await capture(page, '320-onboarding-errors', true);
    await page.getByLabel('Phone (with country code)').fill('+919876543210');
    await page.getByLabel('City', { exact: true }).fill('Pune');
    await page.getByLabel('State / region').fill('Maharashtra');
    await page.getByLabel('Country', { exact: true }).fill('India');
    await page.getByRole('button', { name: 'Save & continue' }).focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'Education & status', exact: true }),
    ).toBeFocused();
    await page.reload();
    await page.getByLabel('Education level').selectOption('UNDERGRADUATE');
    await page
      .getByLabel('Current status')
      .selectOption('WORKING_PROFESSIONAL');
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await page
      .getByLabel('What would you like to achieve?')
      .fill('Build thoughtful practical skills through guided projects.');
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await page.getByRole('checkbox').focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Review checkout summary' }).click();
    await page.waitForURL(`**/checkout/${ref}`);
    await expect(
      page.getByRole('button', { name: 'Continue to Payment' }),
    ).toBeDisabled();
    await expect(page.locator('#payment-unavailable')).toBeVisible();
    await widths(page, 'checkout-runtime-gated');
    const response = await context.request.get(
      `/api/marketplace/enrollment/${ref}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    const view = await response.json();
    expect(
      (
        await context.request.post('/api/marketplace/commerce/orders', {
          headers: { origin: 'https://attacker.invalid' },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await context.request.post('/api/marketplace/commerce/orders', {
          headers: { origin },
          data: {
            intentRef: view.ref,
            revision: view.revision,
            termsVersion: 'test-fixture-terms-v1',
            acknowledge: true,
          },
        })
      ).status(),
    ).toBe(503);
    const initialCookie = await context.cookies();
    expect(
      initialCookie.some(
        (c) => c.name === 'mentoralm-enrollment' && c.httpOnly,
      ),
    ).toBe(true);
    const denied = await context.browser()!.newContext();
    expect(
      (await denied.request.get(`/api/marketplace/enrollment/${ref}`)).status(),
    ).toBe(401);
    expect([302, 303, 307, 308]).toContain(
      (
        await denied.request.get(`/checkout/${ref}`, { maxRedirects: 0 })
      ).status(),
    );
    expect(
      (
        await denied.request.post('/api/marketplace/commerce/orders', {
          headers: { origin },
          data: {},
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await denied.request.post(
          `/api/marketplace/commerce/orders/${fixtures.active.orderRef}/return`,
          { headers: { origin }, data: { paid: true } },
        )
      ).status(),
    ).toBe(401);
    await denied.close();
    // Test-only component harness supplies synthetic legal policy/transport. Runtime gates stay closed.
    const fixture = {
      view,
      availability: 'available',
      policy: {
        version: 'test-fixture-terms-v1',
        termsPath: '/fixture-terms',
        privacyPath: '/fixture-privacy',
      },
    };
    const css = [
      'src/styles/global.css',
      'src/styles/marketplace-enrollment.css',
    ]
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const data = JSON.stringify(fixture).replaceAll('<', '\\u003c');
    await page.route('**/__m6-native-checkout', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>M6 isolated native checkout</title><style>${css}body{font-family:Arial,sans-serif;font-size:16px}.enrollment-main{padding-top:48px}dialog{max-width:calc(100vw - 32px);border:1px solid #7766aa;border-radius:16px;padding:24px}dialog button{display:block;margin:16px 0;padding:12px}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #a986ff;outline-offset:3px}</style></head><body><div id="m6-root"></div><script id="m6-data" type="application/json">${data}</script><script src="/__m6-client.js"></script></body></html>`,
      }),
    );
    await page.route('**/__m6-client.js', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: readFileSync(`${directory}/payment-fixture.js`),
      }),
    );
    let failScriptOnce = true;
    await page.route(
      'https://checkout.razorpay.com/v1/checkout.js',
      (route) => {
        if (failScriptOnce) {
          failScriptOnce = false;
          return route.abort();
        }
        return route.fulfill({
          contentType: 'application/javascript',
          body: `window.Razorpay=class {constructor(options){this.options=options} on(){} open(){const d=document.createElement('dialog');d.setAttribute('aria-label','Simulated provider checkout');d.innerHTML='<h2>Simulated provider checkout</h2><p>No real payment will occur.</p><button id="m6-complete">Complete simulated payment</button><button id="m6-close">Close payment window</button>';document.body.append(d);d.showModal();const close=()=>{d.close();d.remove();this.options.modal.ondismiss()};d.addEventListener('cancel',event=>{event.preventDefault();close()});document.getElementById('m6-close').onclick=close;document.getElementById('m6-complete').onclick=async()=>{const r=await fetch('/__m6-capture',{method:'POST'});const result=await r.json();d.close();d.remove();this.options.handler(result)};document.getElementById('m6-close').focus()}};`,
        });
      },
    );
    await page.route('**/api/marketplace/commerce/**', async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname.split('/').filter(Boolean),
        body = request.postDataJSON();
      let result;
      if (path.length === 4) {
        result = action({ action: 'order', body });
        orderRef = result.ref;
      } else if (path.at(-1) === 'pay')
        result = action({ action: 'pay', ref: path[4] });
      else if (path.at(-1) === 'return')
        result = action({ action: 'return', ref: path[4], body });
      else return route.continue();
      await route.fulfill({
        contentType: 'application/json',
        headers: { 'cache-control': 'private, no-store' },
        body: JSON.stringify(result),
      });
    });
    await page.route('**/__m6-capture', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(action({ action: 'capture', ref: orderRef })),
      }),
    );
    await page.goto('/__m6-native-checkout');
    const pay = page.getByRole('button', { name: 'Continue to Payment' });
    await expect(pay).toBeDisabled();
    await page.getByRole('checkbox').check();
    await widths(page, 'native-provider-launch');
    await pay.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText(
      'Payment checkout is unavailable',
    );
    await expect(pay).toBeFocused();
    await pay.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture(page, '320-provider-dialog', true);
    await page.keyboard.press('Escape');
    await expect(pay).toBeFocused();
    await expect(page.getByRole('status')).toContainText('closed');
    await pay.click();
    await page
      .getByRole('button', { name: 'Complete simulated payment' })
      .click();
    await page.waitForURL(/\/orders\/[A-Za-z0-9_-]{43}$/);
    await expect(
      page.getByRole('heading', { name: 'Payment successful', exact: true }),
    ).toBeVisible();
    await page.unroute('**/api/marketplace/commerce/**');
    expect(
      await page.locator('head meta[name="robots"]').getAttribute('content'),
    ).toContain('noindex');
    await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
    const privateResponse = await context.request.get(`/orders/${orderRef}`);
    expect(privateResponse.headers()['cache-control']).toContain('no-store');
    await widths(page, 'paid-order');
    await page.goto('/dashboard/programs');
    await expect(
      page.getByRole('heading', { name: 'My Programs', exact: true }),
    ).toBeVisible();
    const card = page
      .locator('.my-program-card')
      .filter({ hasText: 'M6 Launch Readiness Program' });
    await expect(
      card.getByRole('link', { name: 'Continue Learning' }),
    ).toBeVisible();
    await widths(page, 'my-programs');
    await card.getByRole('link', { name: 'Continue Learning' }).click();
    await expect(page.locator('main')).toContainText('M6 Guided Learning');
    await widths(page, 'learning-access');
    // Session loss/other browser cannot read the now-paid Order; provider settlement remains durable.
    const other = await context.browser()!.newContext();
    expect(
      (
        await other.request.get(`/api/marketplace/commerce/orders/${orderRef}`)
      ).status(),
    ).toBe(401);
    await other.close();
    await page.goto('/admin/marketplace');
    await expect(
      page.getByRole('heading', { name: 'Marketplace', exact: true }),
    ).toBeVisible();
    await widths(page, 'admin-catalogue');
    await page.goto(`/admin/marketplace/${fixtures.offeringRef}`);
    await page
      .getByRole('button', { name: 'Program page', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Program page', exact: true }),
    ).toBeVisible();
    await widths(page, 'admin-page-editor');
    await page.goto('/admin/marketplace/orders');
    await expect(
      page.getByRole('heading', { name: 'Orders', exact: true }),
    ).toBeVisible();
    await widths(page, 'admin-orders');
    await page.goto(`/admin/marketplace/orders/${fixtures.review.orderRef}`);
    await expect(
      page.getByRole('button', { name: 'Retry Provisioning' }),
    ).toBeVisible();
    await widths(page, 'admin-delivery');
    await db.course.update({
      where: { id: fixtures.review.courseId },
      data: { published: true },
    });
    await page.getByRole('button', { name: 'Retry Provisioning' }).click();
    await expect(page.locator('.commerce-admin-details').last()).toContainText(
      'active',
    );
    const toggle = page.getByRole('button', {
      name: 'Light mode',
      exact: true,
    });
    if (await toggle.count()) await toggle.click();
    else
      await page
        .getByRole('button', { name: 'Dark mode', exact: true })
        .click();
    await capture(page, '320-admin-delivery-theme', true);
    // Paid stale enrollment can become unavailable without making false payment claims.
    await db.marketplaceOffering.update({
      where: { slug: fixtures.slug },
      data: { publicationStatus: 'UNPUBLISHED' },
    });
    await page.goto(`/enroll/${ref}`);
    await expect(page.locator('main')).not.toContainText(
      'You have not been charged',
    );
    expect(action({ action: 'view', ref: orderRef }).status).toBe('PAID');
    action({ action: 'refund', ref: orderRef });
    await page.goto('/dashboard/programs');
    await expect(
      page
        .locator('.my-program-card')
        .filter({ hasText: 'M6 Launch Readiness Program' }),
    ).toHaveCount(0);
    await page.goto(`/orders/${orderRef}`);
    await expect(
      page.getByRole('heading', { name: 'Payment refunded', exact: true }),
    ).toBeVisible();
    await capture(page, '320-refunded-order', true);
  } finally {
    if (sessionId)
      await clerk.sessions.revokeSession(sessionId).catch(() => {});
  }
});
