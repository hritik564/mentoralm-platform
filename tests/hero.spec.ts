import { test, expect } from '@playwright/test';

test('Menti blinks on pointer and keyboard activation, including paused and reduced motion', async ({
  page,
}) => {
  await page.goto('/');
  const hero = page.locator('.hero--cinematic');
  const menti = hero.getByRole('button', { name: 'Make Menti blink' });
  await expect(menti).toBeEnabled();
  await hero.getByRole('button', { name: 'Pause motion' }).click();
  const bounds = await menti.boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);

  async function inspectClosedEyes() {
    const result = await menti.evaluate((element) => {
      const eyes = element.querySelector('.menti-eyes')!;
      const animations = eyes
        .getAnimations()
        .filter((animation) => animation.id === 'menti-activation-blink');
      const animation = animations[0];
      if (!animation) return null;
      animation.pause();
      const duration = Number(animation.effect!.getTiming().duration);
      animation.currentTime = duration / 2;
      return {
        count: animations.length,
        duration,
        scale: new DOMMatrix(getComputedStyle(eyes).transform).m22,
      };
    });
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
    expect(result!.scale).toBeLessThan(0.1);
    return result!;
  }

  await menti.click();
  expect((await inspectClosedEyes()).duration).toBe(280);
  // Repeated activation replaces the active blink rather than stacking effects.
  await menti.click();
  await inspectClosedEyes();
  await menti.focus();
  for (const key of ['Enter', 'Space']) {
    await page.keyboard.press(key);
    await inspectClosedEyes();
    await expect(menti).toBeFocused();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await menti.click();
  expect((await inspectClosedEyes()).duration).toBe(120);
  await menti.evaluate((element) => {
    element
      .querySelector('.menti-eyes')!
      .getAnimations()
      .find((animation) => animation.id === 'menti-activation-blink')!
      .finish();
  });
  await expect
    .poll(() =>
      hero.evaluate(
        (element) => element.getAnimations({ subtree: true }).length,
      ),
    )
    .toBe(0);
  expect(
    await menti
      .locator('.menti-eyes')
      .evaluate(
        (element) => new DOMMatrix(getComputedStyle(element).transform).m22,
      ),
  ).toBe(1);
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('Menti remains visible without JavaScript and its blink control is disabled', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(
      page.locator('.hero--cinematic .menti-character'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Make Menti blink' }),
    ).toBeDisabled();
    await expect(page.locator('.menti-speech')).toContainText('Coming soon');
  } finally {
    await context.close();
  }
});

test('hero capability links stay readable and separate from essential content', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const hero = page.locator('.hero--cinematic');
  const cards = hero.locator('.hero-capability');
  await expect(cards).toHaveCount(4);
  for (const title of [
    'Personalized Learning Paths',
    'Global Opportunities',
    'Human Expertise',
    'Career Intelligence',
  ]) {
    const card = cards.filter({ hasText: title });
    await expect(card).toBeVisible();
    const target = await card.getAttribute('href');
    await expect(page.locator(target!)).toHaveCount(1);
  }
  const geometry = await hero.evaluate((element) => {
    const rect = (selector: string) =>
      element.querySelector(selector)!.getBoundingClientRect();
    const intersects = (a: DOMRect, b: DOMRect) =>
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top;
    const essential = [rect('h1'), rect('.hero-actions'), rect('.menti-dock')];
    const cardRects = [...element.querySelectorAll('.hero-capability')].map(
      (card) => card.getBoundingClientRect(),
    );
    return {
      overlap: cardRects.some((card) =>
        essential.some((item) => intersects(card, item)),
      ),
      outside: cardRects.some(
        (card) => card.left < 0 || card.right > innerWidth,
      ),
      clippedText: [
        ...element.querySelectorAll('h1 > span, .hero-capability strong'),
      ].some((text) => text.scrollWidth > text.clientWidth + 1),
      image: (element.querySelector('.hero-student img') as HTMLImageElement)
        .naturalWidth,
    };
  });
  expect(geometry.overlap).toBeFalsy();
  expect(geometry.outside).toBeFalsy();
  expect(geometry.clippedText).toBeFalsy();
  expect(geometry.image).toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath('hero-reduced-motion.png'),
    fullPage: false,
  });
  await hero.screenshot({ path: testInfo.outputPath('hero-complete.png') });
  const menti = hero.getByRole('button', { name: /Meet Menti/ });
  await menti.focus();
  await expect(menti).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('hero-menti-focus.png') });
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Meet Menti. Soon.' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('not available');
  await page.keyboard.press('Escape');
  await expect(menti).toBeFocused();
});

test('hero motion can be paused and reduced motion resets pupil tracking', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const hero = page.locator('.hero--cinematic');
  const pause = hero.locator('.hero-motion-control');
  await pause.click();
  await expect(hero).toHaveAttribute('data-motion-paused', 'true');
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  expect(
    await hero.evaluate(
      (element) =>
        element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === 'running').length,
    ),
  ).toBe(0);
  await pause.click();
  await expect(hero).toHaveAttribute('data-motion-paused', 'false');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.mouse.move(20, 20);
  await page.mouse.move((page.viewportSize()?.width ?? 0) - 40, 210);
  if (!testInfo.project.use.hasTouch) {
    await expect
      .poll(() =>
        hero.evaluate((element) => {
          const transform = new DOMMatrix(
            getComputedStyle(element.querySelector('.menti-pupils')!).transform,
          );
          return Math.abs(transform.m41);
        }),
      )
      .toBeGreaterThan(0.1);
    const gaze = await hero.evaluate((element) => {
      const transform = new DOMMatrix(
        getComputedStyle(element.querySelector('.menti-pupils')!).transform,
      );
      return { x: Math.abs(transform.m41), y: Math.abs(transform.m42) };
    });
    expect(gaze.x).toBeLessThanOrEqual(2.4);
    expect(gaze.y).toBeLessThanOrEqual(1.8);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(pause).toBeHidden();
  await expect
    .poll(() =>
      hero.evaluate(
        (element) =>
          getComputedStyle(element.querySelector('.menti-pupils')!).transform,
      ),
    )
    .toBe('none');
  expect(
    await hero.evaluate(
      (element) =>
        element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === 'running').length,
    ),
  ).toBe(0);
  await page.mouse.move(40, 240);
  expect(
    await hero.evaluate((element) =>
      element.style.getPropertyValue('--menti-gaze-x'),
    ),
  ).toBe('0px');
});

test('capture staged hero and Menti keyboard reaction', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const hero = page.locator('.hero--cinematic');
  await hero.locator('.hero-enter').evaluateAll(async (elements) => {
    await Promise.all(
      elements
        .flatMap((element) => element.getAnimations())
        .map((animation) => animation.finished),
    );
  });
  await page.screenshot({ path: testInfo.outputPath('hero-opening.png') });
  await hero.getByRole('button', { name: /Meet Menti/ }).focus();
  await page.screenshot({
    path: testInfo.outputPath('hero-menti-reaction.png'),
  });
});
