import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('header stays anchored, compacts without shifting content, and respects reduced motion', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const header = page.locator('.site-header');
  const initialHeight = (await header.boundingBox())!.height;
  const initialRailHeight = (await page.locator('.nav-bar').boundingBox())!
    .height;
  await expect(header).toHaveAttribute('data-scrolled', 'false');
  await page.screenshot({ path: testInfo.outputPath('r1-top.png') });
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await expect(header).toHaveAttribute('data-scrolled', 'true');
  expect((await header.boundingBox())!.y).toBe(0);
  expect((await header.boundingBox())!.height).toBe(initialHeight);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.locator('.nav-bar').evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const compactHeight = (await page.locator('.nav-bar').boundingBox())!.height;
  expect(compactHeight).toBe(
    (page.viewportSize()?.width ?? 0) >= 960
      ? initialRailHeight - 8
      : initialRailHeight,
  );
  await page.screenshot({ path: testInfo.outputPath('r1-sticky.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.nav-bar')
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe('0s');
  expect(
    await page
      .locator('.nav-bar')
      .evaluate((element) => getComputedStyle(element).transform),
  ).toBe('none');
});

test('mobile navigation contains focus, unlocks on close/resize, and cooperates with Login dialog', async ({
  page,
}, testInfo) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) >= 960,
    'Mobile interaction only',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(nav).toBeVisible();
  expect(
    await page.locator('body').evaluate((element) => element.style.overflow),
  ).toBe('hidden');
  expect(
    await page
      .locator('main')
      .evaluate((element) => element instanceof HTMLElement && element.inert),
  ).toBeTruthy();
  await nav.getByRole('button', { name: 'Login / Sign up' }).focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'MentoraLM home' }).first(),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    nav.getByRole('button', { name: 'Login / Sign up' }),
  ).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('r1-mobile-menu.png') });
  const login = nav.getByRole('button', { name: /Login/ });
  await login.click();
  const dialog = page.getByRole('dialog', {
    name: 'One account. A world of possibilities.',
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(nav).toBeVisible();
  await expect(login).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(
    await page.locator('body').evaluate((element) => element.style.overflow),
  ).toBe('');
  expect(
    await page
      .locator('main')
      .evaluate((element) => element instanceof HTMLElement && element.inert),
  ).toBeFalsy();
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(nav).toBeHidden();
  expect(
    await page.locator('body').evaluate((element) => element.style.overflow),
  ).toBe('');
  await expect(
    page.getByRole('link', { name: 'MentoraLM home' }).first(),
  ).toBeFocused();
});

test('Modules dropdown lists all seven entries, supports keyboard dismissal, and links to existing content', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const mobile = (page.viewportSize()?.width ?? 0) < 960;
  if (mobile)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  const nav = page.getByRole('navigation', {
    name: mobile ? 'Mobile navigation' : 'Main navigation',
  });
  const trigger = nav.getByRole('button', {
    name: mobile ? '01 Modules' : 'Modules',
    exact: true,
  });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const panel = trigger.locator('..').locator('.modules-panel');
  await expect(panel.locator('li')).toHaveCount(7);
  await expect(panel.locator('.modules-list a')).toHaveCount(5);
  await expect(panel.getByText('Coming soon', { exact: true })).toHaveCount(2);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('modules-dropdown.png') });
  await trigger.focus();
  await page.keyboard.press('Tab');
  await expect(panel.locator('.modules-list a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  if (mobile) await expect(nav).toBeVisible();
  await trigger.click();
  await nav
    .getByRole('link', {
      name: mobile ? '02 Opportunities' : 'Opportunities',
      exact: true,
    })
    .click();
  await expect(panel).toBeHidden();
  if (mobile)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await trigger.click();
  await panel.getByRole('link', { name: /GradLM/ }).click();
  await expect(page).toHaveURL(/#story-gradlm$/);
  await expect(panel).toBeHidden();
  if (mobile) await expect(nav).toBeHidden();
});
