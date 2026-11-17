import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin = 'http://127.0.0.1:3111';
const headline = 'Your Future, Powered by MentoraLM';
const programs = ['CareerIgnite', 'YoungMinds AI Lab'] as const;
const safety = new WeakMap<
  Page,
  {
    external: string[];
    protected: string[];
    mutations: string[];
    failedAssets: string[];
    errors: string[];
  }
>();

async function publicOnly(page: Page) {
  const state = {
    external: [] as string[],
    protected: [] as string[],
    mutations: [] as string[],
    failedAssets: [] as string[],
    errors: [] as string[],
  };
  safety.set(page, state);
  page.on('pageerror', (error) => state.errors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && response.status() >= 400)
      state.failedAssets.push(`${response.status()} ${url.pathname}`);
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      state.external.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      state.mutations.push(`${request.method()} ${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }
    if (
      /^\/(?:api|admin|admin-auth|dashboard|learn|students|sign-in|sign-up)(?:\/|$)/.test(
        url.pathname,
      ) ||
      (url.pathname === '/_next/image' &&
        !url.searchParams.get('url')?.startsWith('/'))
    ) {
      state.protected.push(url.pathname);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
}

function assertPublicOnly(page: Page) {
  const state = safety.get(page)!;
  expect(state.external, 'Public UI must use local assets only').toEqual([]);
  expect(
    state.protected,
    'No API, auth, or protected workspace requests',
  ).toEqual([]);
  expect(
    state.mutations,
    'Public presentation checks issue no mutations',
  ).toEqual([]);
  expect(
    state.failedAssets,
    'Public assets and routes must load successfully',
  ).toEqual([]);
  expect(state.errors, 'No browser runtime exceptions').toEqual([]);
}

test.beforeEach(async ({ page }) => publicOnly(page));
test.afterEach(async ({ page }) => assertPublicOnly(page));

async function opening(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: headline, exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole('region', {
    name: 'MentoraLM programs',
    exact: true,
  });
  await expect(carousel).toBeVisible();
  return carousel;
}

function slide(carousel: Locator, index: number) {
  return carousel.getByRole('group', {
    name: `${index + 1} of 2: ${programs[index]}`,
    exact: true,
    includeHidden: true,
  });
}

async function activeProgram(carousel: Locator, index: number) {
  const active = slide(carousel, index);
  const inactive = slide(carousel, 1 - index);
  await expect(active).toBeVisible();
  await expect(active).toHaveAttribute('aria-hidden', 'false');
  await expect(active).toHaveJSProperty('inert', false);
  await expect(inactive).toBeHidden();
  await expect(inactive).toHaveAttribute('aria-hidden', 'true');
  await expect(inactive).toHaveJSProperty('inert', true);
  await expect(
    active.getByRole('heading', { name: programs[index], exact: true }),
  ).toBeVisible();
  const image = active.locator('img').first();
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  return active;
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Homepage must fit the viewport',
  ).toBe(true);
}

test('homepage presents the approved program copy, two local visuals and existing destinations', async ({
  page,
}) => {
  const carousel = await opening(page);
  await expect(
    carousel.locator('[role="group"][aria-roledescription="slide"]'),
  ).toHaveCount(2);
  const first = await activeProgram(carousel, 0);
  await expect(first).toContainText('MentoraLM Program');
  await expect(first).toContainText(
    'Build Skills. Gain Confidence. Get Career Ready.',
  );
  for (const label of ['Career Readiness', 'Live Mentoring', 'Projects'])
    await expect(first.getByText(label, { exact: true })).toBeVisible();
  await expect(
    first.getByRole('link', { name: 'Explore Program', exact: true }),
  ).toHaveAttribute('href', '#story-careerignite');
  await expect(page.locator('#story-careerignite')).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Get Started Today', exact: true }),
  ).toHaveAttribute('href', /(?:^|\/)sign-up$/);
  await expect(page.locator('main')).toContainText(
    'MentoraLM connects career guidance, learning, and opportunities in one powerful platform for students across India.',
  );
  await carousel
    .getByRole('button', { name: 'Next program', exact: true })
    .click();
  const second = await activeProgram(carousel, 1);
  await expect(second).toContainText('AI & Tech Discovery for Young Learners');
  for (const label of ['AI Basics', 'Creative Learning', 'Future Skills'])
    await expect(second.getByText(label, { exact: true })).toBeVisible();
  const explore = second.getByRole('link', {
    name: 'Explore Program',
    exact: true,
  });
  await expect(explore).toHaveAttribute('href', '#youngminds-ai-lab');
  await expect(page.locator('#youngminds-ai-lab')).toHaveCount(1);
  await explore.click();
  const dialog = page.getByRole('dialog', { name: /YoungMinds AI Lab/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    /not available|coming soon|preview|later|details/i,
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(explore).toBeFocused();
  const assets = await carousel
    .locator('img')
    .evaluateAll((images) =>
      images.map(
        (image) =>
          new URL(
            (image as HTMLImageElement).currentSrc ||
              (image as HTMLImageElement).src,
          ).origin,
      ),
    );
  expect(assets.every((assetOrigin) => assetOrigin === origin)).toBe(true);
});

test('carousel arrows, indicators, preview and keyboard select programs without automatic rotation', async ({
  page,
}) => {
  await page.clock.install();
  const carousel = await opening(page);
  await activeProgram(carousel, 0);
  await page.clock.fastForward(60_000);
  await activeProgram(carousel, 0);
  const next = carousel.getByRole('button', {
    name: 'Next program',
    exact: true,
  });
  await next.focus();
  await page.keyboard.press('Enter');
  await activeProgram(carousel, 1);
  await expect(next).toBeFocused();
  const previous = carousel.getByRole('button', {
    name: 'Previous program',
    exact: true,
  });
  await previous.focus();
  await page.keyboard.press('Space');
  await activeProgram(carousel, 0);
  await expect(previous).toBeFocused();
  await carousel
    .getByRole('button', { name: 'Show YoungMinds AI Lab', exact: true })
    .click();
  await activeProgram(carousel, 1);
  await carousel
    .getByRole('button', { name: 'Show CareerIgnite', exact: true })
    .click();
  await activeProgram(carousel, 0);
  await carousel.focus();
  await page.keyboard.press('ArrowLeft');
  await activeProgram(carousel, 1);
  await page.keyboard.press('ArrowRight');
  await activeProgram(carousel, 0);
  const preview = carousel.getByRole('button', {
    name: 'Next program: YoungMinds AI Lab',
    exact: true,
  });
  await expect(preview).toBeVisible();
  await preview.click();
  await activeProgram(carousel, 1);
  await expect(
    carousel.getByRole('button', {
      name: 'Next program: CareerIgnite',
      exact: true,
    }),
  ).toBeVisible();
});

test('restored desktop navigation retains Modules, existing links and the account sheet', async ({
  page,
}) => {
  await opening(page);
  const nav = page.getByRole('navigation', {
    name: 'Main navigation',
    exact: true,
  });
  await expect(nav).toBeVisible();
  for (const label of ['Opportunities', 'Resources', 'About'])
    await expect(
      nav.getByRole('link', { name: label, exact: true }),
    ).toBeVisible();
  const modules = nav.getByRole('button', { name: 'Modules', exact: true });
  await modules.focus();
  await page.keyboard.press('Enter');
  await expect(modules).toHaveAttribute('aria-expanded', 'true');
  const panel = modules.locator('..').locator('.modules-panel');
  await expect(panel.locator('li')).toHaveCount(7);
  await expect(panel.locator('.modules-list a')).toHaveCount(5);
  await expect(panel.getByText('Coming soon', { exact: true })).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(modules).toBeFocused();
  const login = page
    .locator('.site-header .nav-actions')
    .getByRole('button', { name: 'Login / Sign up', exact: true });
  await login.click();
  const dialog = page.getByRole('dialog', {
    name: 'One account. A world of possibilities.',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Close authentication', exact: true }),
  ).toBeFocused();
  await expect(
    dialog.getByRole('heading', {
      name: 'Sign-in is not available yet',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Login', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await dialog
    .getByRole('button', { name: 'Create Account', exact: true })
    .click();
  await expect(
    dialog.getByRole('button', { name: 'Create Account', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(login).toBeFocused();
});

test('restored mobile navigation contains focus and retains Modules and the Login sheet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await opening(page);
  const trigger = page.getByRole('button', {
    name: 'Open navigation',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const nav = page.getByRole('navigation', {
    name: 'Mobile navigation',
    exact: true,
  });
  await expect(nav).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Close navigation', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect(page.locator('main')).toHaveJSProperty('inert', true);
  const controls = page.locator(
    'header a[href]:visible, header button:not([disabled]):visible',
  );
  await controls.last().focus();
  await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(controls.last()).toBeFocused();
  const modules = nav.getByRole('button', { name: '01 Modules', exact: true });
  await modules.click();
  const panel = modules.locator('..').locator('.modules-panel');
  await expect(panel.locator('li')).toHaveCount(7);
  await panel.locator('.modules-list a').first().focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(modules).toBeFocused();
  await expect(nav).toBeVisible();
  const login = nav.getByRole('button', {
    name: 'Login / Sign up',
    exact: true,
  });
  await login.click();
  const dialog = page.getByRole('dialog', {
    name: 'One account. A world of possibilities.',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Close authentication', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(nav).toBeVisible();
  await expect(login).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('main')).toHaveJSProperty('inert', false);
  expect(
    await page.locator('body').evaluate((element) => element.style.overflow),
  ).toBe('');
  await trigger.click();
  await nav
    .getByRole('link', { name: '02 Opportunities', exact: true })
    .click();
  await expect(page).toHaveURL(/#opportunities$/);
  await expect(nav).toBeHidden();
  await expect(page.locator('main')).toHaveJSProperty('inert', false);
  await noOverflow(page);
});

test('reduced motion retains manual navigation and a static visible carousel', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const carousel = await opening(page);
  await activeProgram(carousel, 0);
  await carousel
    .getByRole('button', { name: 'Next program', exact: true })
    .click();
  await activeProgram(carousel, 1);
  expect(
    await carousel.evaluate(
      (element) =>
        element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === 'running').length,
    ),
  ).toBe(0);
  await expect(
    page.getByRole('heading', { level: 1, name: headline, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Get Started Today', exact: true }),
  ).toBeVisible();
});

for (const width of [1672, 1440, 1024, 820, 390, 320])
  test(`${width}px homepage opening and both programs fit without accessibility violations`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width,
      height: width === 1672 ? 941 : width < 600 ? 844 : 1000,
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const carousel = await opening(page);
    for (const index of [0, 1]) {
      if (index)
        await carousel
          .getByRole('button', { name: 'Next program', exact: true })
          .click();
      const active = await activeProgram(carousel, index);
      await noOverflow(page);
      const clipped = await active
        .locator('h2, p, a, button, li')
        .evaluateAll((elements) =>
          elements
            .filter(
              (element) =>
                element.clientWidth > 0 &&
                element.scrollWidth > element.clientWidth + 1,
            )
            .map((element) => element.textContent),
        );
      expect(clipped, 'Program copy and actions must remain readable').toEqual(
        [],
      );
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({
        path: testInfo.outputPath(`homepage-${width}-${index + 1}.png`),
      });
      await carousel.screenshot({
        path: testInfo.outputPath(`program-${width}-${index + 1}.png`),
      });
    }
  });

test('server-rendered homepage remains useful without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await publicOnly(page);
  try {
    await page.goto(baseURL!);
    await expect(
      page.getByRole('heading', { level: 1, name: headline, exact: true }),
    ).toBeVisible();
    const carousel = page.getByRole('region', {
      name: 'MentoraLM programs',
      exact: true,
    });
    await expect(
      carousel.getByRole('heading', { name: 'CareerIgnite', exact: true }),
    ).toBeVisible();
    await expect(
      carousel
        .getByRole('link', { name: 'Explore Program', exact: true })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Get Started Today', exact: true }),
    ).toHaveAttribute('href', /(?:^|\/)sign-up$/);
    await expect(page.locator('#programs .module-card')).toHaveCount(7);
    const fallbackNavigation = page.getByRole('navigation', {
      name: 'Navigation without JavaScript',
      exact: true,
    });
    await expect(fallbackNavigation).toBeVisible();
    await expect(fallbackNavigation.getByRole('link')).toHaveText([
      'Modules',
      'Opportunities',
      'Resources',
      'About',
    ]);
    await expect(
      fallbackNavigation.getByRole('link', { name: 'Modules', exact: true }),
    ).toHaveAttribute('href', '#programs');
    await noOverflow(page);
    await page.goto(`${baseURL}/#youngminds-ai-lab`);
    await expect(page.locator('#youngminds-ai-lab')).toBeVisible();
    await expect(page.locator('#youngminds-ai-lab')).toContainText(
      'Full program details, eligibility and enrollment are not available yet.',
    );
    assertPublicOnly(page);
  } finally {
    await context.close();
  }
});
