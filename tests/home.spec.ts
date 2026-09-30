import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { programs } from '../src/content/programs';
import { getSiteOrigin } from '../src/lib/site';

test('seven public module positions and strict origin configuration', () => {
  expect(programs).toHaveLength(7);
  expect(new Set(programs.map((program) => program.id)).size).toBe(7);
  expect(
    programs.filter((program) => program.status === 'coming-soon'),
  ).toHaveLength(2);
  expect(getSiteOrigin('')).toBeUndefined();
  expect(getSiteOrigin('https://mentoralm.example')?.origin).toBe(
    'https://mentoralm.example',
  );
  for (const value of [
    'javascript:alert(1)',
    'https://user:password@mentoralm.example',
    'https://mentoralm.example/private',
    'https://mentoralm.example?query=1',
    'not a URL',
  ])
    expect(() => getSiteOrigin(value)).toThrow();
});

test('homepage is rendered with public SEO content before JavaScript', async ({
  request,
}) => {
  const response = await request.get('/');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain('<h1');
  expect(html).toContain('Your Future');
  expect(html).toContain('name="description"');
  expect(html).toContain('property="og:title"');
  expect(html).not.toContain('application/ld+json');
  for (const id of [
    'programs',
    'about',
    'journey',
    'opportunities',
    'resources',
  ])
    expect(html).toContain(`id="${id}"`);
});

test('homepage has no runtime errors, overflow, missing image, or dead anchor', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your FutureDeserves MoreThan a Guess.',
  );
  await expect(page.locator('.program-card')).toHaveCount(7);
  await expect(page.locator('.program-card--soon')).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  for (const section of await page.locator('main > section').all()) {
    await section.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  const broken = await page
    .locator('a[href^="#"]')
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute('href')!)
        .filter(
          (href) => !document.getElementById(decodeURIComponent(href.slice(1))),
        ),
    );
  expect(broken).toEqual([]);
  for (const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty('complete', true);
  }
  const unloaded = await page
    .locator('img')
    .evaluateAll((images) =>
      images
        .filter((image) => (image as HTMLImageElement).naturalWidth === 0)
        .map((image) => image.getAttribute('src')),
    );
  expect(unloaded).toEqual([]);
  expect(errors).toEqual([]);
});

test('responsive navigation works with keyboard, escape, and anchor selection', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  if ((page.viewportSize()?.width ?? 0) < 960) {
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Close navigation' }),
    ).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(
      page
        .getByRole('navigation', { name: 'Mobile navigation' })
        .getByRole('button', { name: '01 Modules' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(
      page.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeHidden();
    await trigger.click();
    await page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link', { name: '02 Opportunities' })
      .click();
    await expect(page).toHaveURL(/#opportunities$/);
    await expect(
      page.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeHidden();
  } else {
    await expect(trigger).toBeHidden();
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: 'Modules', exact: true })
      .click();
    await page.getByRole('link', { name: 'Explore all modules' }).click();
    await expect(page).toHaveURL(/#programs$/);
  }
});

test('future feature dialog is honest, traps focus, and restores it', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /Meet Menti/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Meet Menti. Soon.' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('It is not available yet');
  await expect(
    dialog.getByRole('button', { name: 'Close dialog' }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', { name: 'Keep exploring' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole('button', { name: 'Keep exploring' }).click();
  await expect(dialog).toBeHidden();
});

test('reduced motion keeps content visible and the homepage passes accessibility checks', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.reveal-pending')).toHaveCount(0);
  expect(
    await page
      .locator('.hero__ambient')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: /Meet Menti/ }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test('homepage remains readable without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.program-card')).toHaveCount(7);
  await expect(page.locator('.reveal-pending')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Explore Programs', exact: true }),
  ).toBeVisible();
  await context.close();
});

test('capture actual visual-review artifacts', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty('complete', true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath('homepage.png'),
    fullPage: true,
  });
  await page.screenshot({ path: testInfo.outputPath('opening.png') });
});

test('planned opportunities disclose scope and narrow screens remain usable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const disclosure = page.locator('#opportunity-note');
  await disclosure.getByText('Explore Opportunities', { exact: true }).click();
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(disclosure).toContainText('later phase');
  if ((page.viewportSize()?.width ?? 0) < 960) {
    await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Open navigation' }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});
