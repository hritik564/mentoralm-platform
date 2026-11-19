import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { terms20261119 } from '../src/content/legal/terms-2026-11-19-v1';
import { privacy20261119 } from '../src/content/legal/privacy-2026-11-19-v1';
const review = 'docs/reviews/legal-v1';
const normalize = (v: string) =>
  v
    .replace(/^#{1,3} /gm, '')
    .replace(/^(?:- |\d+\. )/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
test('Exact public legal documents, metadata, footer, contacts and four-width accessibility without providers', async ({
  page,
}) => {
  mkdirSync(review, { recursive: true });
  const external: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      external.push(url.hostname);
      await route.abort();
    } else await route.continue();
  });
  let scans = 0;
  for (const [path, source, title] of [
    ['/terms', terms20261119, 'Terms and Conditions | MentoraLM'],
    ['/privacy', privacy20261119, 'Privacy Policy | MentoraLM'],
  ] as const) {
    for (const width of [1440, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveTitle(title);
      expect(
        new URL(
          (await page.locator('link[rel="canonical"]').getAttribute('href'))!,
          page.url(),
        ).pathname,
      ).toBe(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /index, follow/,
      );
      await expect(page.locator('article h1')).toHaveCount(1);
      expect(normalize(await page.locator('article').innerText())).toBe(
        normalize(source.markdown),
      );
      await expect(
        page.locator('main a[href="mailto:care@mentoralm.com"]').first(),
      ).toBeVisible();
      await expect(
        page.locator('main a[href="tel:+918147319393"]').first(),
      ).toHaveText('+91 8147319393');
      await expect(
        page
          .locator('footer')
          .getByRole('link', { name: 'Terms', exact: true }),
      ).toHaveAttribute('href', '/terms');
      await expect(
        page
          .locator('footer')
          .getByRole('link', { name: 'Privacy', exact: true }),
      ).toHaveAttribute('href', '/privacy');
      expect(await page.locator('body').innerText()).not.toContain(
        'Policies are being prepared',
      );
      const html = await response!.text();
      expect(html).not.toMatch(
        /clerkUserId|providerOrderId|studentId|razorpay_payment_id|sk_test_|postgresql:\/\//,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
      scans++;
      await page.screenshot({ path: `${review}/${width}${path}.png` });
    }
    await page.keyboard.press('Tab');
    await page
      .locator('main a[href="mailto:care@mentoralm.com"]')
      .first()
      .focus();
    await expect(
      page.locator('main a[href="mailto:care@mentoralm.com"]').first(),
    ).toBeFocused();
    expect(
      await page
        .locator('main a[href="mailto:care@mentoralm.com"]')
        .first()
        .evaluate((e) => getComputedStyle(e).outlineStyle),
    ).not.toBe('none');
    await page
      .locator('footer')
      .getByRole('link', {
        name: path === '/terms' ? 'Privacy' : 'Terms',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp(path === '/terms' ? '/privacy$' : '/terms$'),
    );
  }
  expect(external).toEqual([]);
  writeFileSync(
    `${review}/browser-summary.json`,
    JSON.stringify(
      {
        scans,
        violations: 0,
        widths: [1440, 820, 390, 320],
        externalProviderRequests: external.length,
      },
      null,
      2,
    ),
  );
});

test('Native checkout consent starts unchecked and links to both real public documents', async ({
  page,
}) => {
  const bundle = readFileSync(`${review}/payment-fixture.js`);
  const styles = ['tokens.css', 'global.css', 'marketplace-enrollment.css']
    .map((f) => readFileSync(`src/styles/${f}`, 'utf8'))
    .join('\n');
  await page.route('**/__legal-ui.js', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: bundle }),
  );
  await page.route('**/__legal-checkout', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><title>Legal consent test</title><style>${styles}</style></head><body><div id="m6-root"></div><script type="application/json" id="m6-data">${JSON.stringify({ view: { quote: { title: 'Legal consent fixture' } }, policy: { version: '2026-11-19-v1', termsPath: '/terms', privacyPath: '/privacy' }, availability: 'available' })}</script><script src="/__legal-ui.js"></script></body></html>`,
    }),
  );
  await page.goto('/__legal-checkout');
  const check = page.getByRole('checkbox');
  await expect(check).not.toBeChecked();
  await expect(
    page.getByRole('button', { name: 'Continue to Payment' }),
  ).toBeDisabled();
  for (const [name, path, title] of [
    ['purchase terms', '/terms', 'MentoraLM Terms and Conditions'],
    ['privacy notice', '/privacy', 'MentoraLM Privacy Policy'],
  ]) {
    await expect(page.getByRole('link', { name })).toHaveAttribute(
      'href',
      path,
    );
    await page.getByRole('link', { name }).click();
    await expect(
      page.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
    await page.goto('/__legal-checkout');
  }
  await check.check();
  await expect(
    page.getByRole('button', { name: 'Continue to Payment' }),
  ).toBeEnabled();
  // No payment click/provider script/network is needed or authorized by this test.
});
