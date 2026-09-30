import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { programs } from '../src/content/programs';

test('seven centralized modules have readable responsive geometry and reuse the exact Hero Menti', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#programs');
  const testViewport = page.viewportSize();
  const section = page.locator('#programs');
  await expect(section.locator('.module-experience')).toHaveAttribute(
    'data-enhanced',
    'true',
  );
  await expect(section.getByRole('heading', { level: 2 })).toHaveText(
    'One Intelligence. Different Paths.',
  );
  await expect(section.locator('.module-card')).toHaveCount(7);
  await expect(
    section.getByText('Explore pathway', { exact: true }),
  ).toHaveCount(0);
  for (const program of programs) {
    const card = section.locator(`[data-module-id="${program.id}"]`);
    await expect(card.getByRole('heading', { level: 3 })).toHaveText(
      program.name,
    );
    await expect(card).toContainText(
      program.id === 'career-counsellor' ? program.description : program.label,
    );
    if (program.status === 'featured') {
      await expect(card).toHaveJSProperty('tagName', 'A');
      await expect(card).toHaveAccessibleName(`Explore ${program.name}`);
      await expect(card).toHaveAttribute(
        'href',
        program.storyId
          ? `#${program.storyId}`
          : `#module-${program.id}-availability`,
      );
      await expect(card.locator('a, button, [tabindex]')).toHaveCount(0);
    }
  }
  const geometry = await section.evaluate((element) => {
    const rects = [...element.querySelectorAll('.module-slot')].map((slot) =>
      slot.getBoundingClientRect(),
    );
    const center = element
      .querySelector('.module-center .menti-character')!
      .getBoundingClientRect();
    const intersects = (a: DOMRect, b: DOMRect) =>
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top;
    return {
      centered:
        Math.abs(
          center.left +
            center.width / 2 -
            element.getBoundingClientRect().left -
            element.getBoundingClientRect().width / 2,
        ) < 2,
      overflow: document.documentElement.scrollWidth > innerWidth,
      overlap:
        innerWidth > 1100 &&
        rects.some(
          (rect, index) =>
            rects.slice(index + 1).some((other) => intersects(rect, other)) ||
            intersects(rect, center),
        ),
      clippedText: [
        ...element.querySelectorAll('h2, h3, .module-card__body > p'),
      ].some((text) => text.scrollWidth > text.clientWidth + 1),
      wideCards:
        innerWidth <= 1100
          ? rects[0].width > innerWidth * (innerWidth <= 640 ? 0.7 : 0.3)
          : true,
    };
  });
  expect(geometry).toEqual({
    centered: true,
    overflow: false,
    overlap: false,
    clippedText: false,
    wideCards: true,
  });
  if ((page.viewportSize()?.width ?? 0) > 1100) {
    const composition = await section.evaluate((element) => {
      const title = element
        .querySelector('.module-heading')!
        .getBoundingClientRect();
      const cards = [...element.querySelectorAll('.module-card')].map((card) =>
        card.getBoundingClientRect(),
      );
      const header = document
        .querySelector('.site-header')!
        .getBoundingClientRect();
      return {
        topClearance:
          Math.min(...cards.map((card) => card.top)) - header.bottom,
        titleClearance: title.top - header.bottom,
        compareHeight:
          Math.max(...cards.map((card) => card.bottom)) - title.top,
        ratios: cards.map((card) => card.width / card.height),
        sideGap: cards[3].top - cards[1].bottom,
        bottomGap: cards[6].left - cards[5].right,
      };
    });
    expect(composition.topClearance).toBeGreaterThan(20);
    expect(composition.titleClearance).toBeGreaterThanOrEqual(20);
    expect(composition.compareHeight).toBeLessThan(815);
    expect(composition.sideGap).toBeGreaterThanOrEqual(45);
    expect(composition.bottomGap).toBeGreaterThanOrEqual(35);
    for (const ratio of composition.ratios) {
      expect(ratio).toBeGreaterThan(1.35);
      expect(ratio).toBeLessThan(1.85);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => {
      location.hash = '';
      location.hash = 'programs';
    });
    // Anchor landing leaves the top card and title below the sticky rail.
    await expect
      .poll(() =>
        section
          .locator('.module-heading')
          .evaluate((el) => el.getBoundingClientRect().top),
      )
      .toBeGreaterThan(100);
    expect(
      await section
        .locator('.module-card')
        .evaluateAll((cards) =>
          cards.every(
            (card) => card.getBoundingClientRect().bottom <= innerHeight,
          ),
        ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    // At a shorter viewport, all seven pathway identities remain in view;
    // the added thread clearance can extend the bottom card border below it.
    expect(
      await section
        .locator('.module-card h3')
        .evaluateAll((headings) =>
          headings.every(
            (heading) => heading.getBoundingClientRect().bottom <= innerHeight,
          ),
        ),
    ).toBe(true);
    await page.setViewportSize(testViewport!);
  }
  const sources = programs
    .filter((program) => program.status === 'featured')
    .map((program) => program.thumbnail);
  expect(new Set(sources).size).toBe(5);
  for (const image of await section.locator('.module-card img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty('complete', true);
    await expect(image).not.toHaveJSProperty('naturalWidth', 0);
  }
  const shapes = await page
    .locator('.menti-character > svg')
    .evaluateAll((elements) =>
      elements.map((element) =>
        [...element.querySelectorAll('path, ellipse, circle')].map((shape) =>
          ['d', 'cx', 'cy', 'rx', 'ry', 'r'].map((name) =>
            shape.getAttribute(name),
          ),
        ),
      ),
    );
  expect(shapes).toHaveLength(3);
  expect(shapes[0]).toEqual(shapes[1]);
  expect(shapes[0]).toEqual(shapes[2]);
  const ids = await page
    .locator('.menti-character [id]')
    .evaluateAll((elements) => elements.map((element) => element.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('module keyboard and hover selection illuminate paths, target existing pupils and reset gaze', async ({
  page,
}) => {
  await page.goto('/#programs');
  const experience = page.locator('.module-experience');
  await expect(experience).toHaveAttribute('data-enhanced', 'true');
  const pupils = experience.locator('.menti-pupils');
  const hero = page.locator('.hero--cinematic');
  const heroGaze = await hero.evaluate((element) => [
    element.style.getPropertyValue('--menti-gaze-x'),
    element.style.getPropertyValue('--menti-gaze-y'),
  ]);
  await experience.locator('[data-module-position="1"] .module-card').focus();
  for (let position = 1; position <= 5; position++) {
    if (position > 1) await page.keyboard.press('Tab');
    const action = experience.locator(
      `[data-module-position="${position}"] .module-card`,
    );
    await expect(action).toBeFocused();
    await expect(experience).toHaveAttribute(
      'data-active-position',
      String(position),
    );
    await expect
      .poll(() =>
        pupils.evaluate((element) => {
          const transform = new DOMMatrix(getComputedStyle(element).transform);
          return Math.hypot(transform.m41, transform.m42);
        }),
      )
      .toBeGreaterThan(0.1);
    const direction = await experience.evaluate((element, position) => {
      const source = element
        .querySelector('.menti-character')!
        .getBoundingClientRect();
      const target = element
        .querySelector(`[data-module-position="${position}"]`)!
        .getBoundingClientRect();
      const transform = new DOMMatrix(
        getComputedStyle(element.querySelector('.menti-pupils')!).transform,
      );
      return {
        x: transform.m41,
        y: transform.m42,
        dx: target.left + target.width / 2 - source.left - source.width / 2,
        dy: target.top + target.height / 2 - source.top - source.height / 2,
      };
    }, position);
    expect(Math.abs(direction.x)).toBeLessThanOrEqual(2.4);
    expect(Math.abs(direction.y)).toBeLessThanOrEqual(1.8);
    // Wait for the short interpolation before assessing the final direction.
    await expect
      .poll(() =>
        experience.evaluate((element, position) => {
          const source = element
            .querySelector('.menti-character')!
            .getBoundingClientRect();
          const target = element
            .querySelector(`[data-module-position="${position}"]`)!
            .getBoundingClientRect();
          const t = new DOMMatrix(
            getComputedStyle(element.querySelector('.menti-pupils')!).transform,
          );
          return (
            t.m41 *
              (target.left +
                target.width / 2 -
                source.left -
                source.width / 2) +
            t.m42 *
              (target.top + target.height / 2 - source.top - source.height / 2)
          );
        }, position),
      )
      .toBeGreaterThan(0);
    if ((page.viewportSize()?.width ?? 0) > 1100) {
      await expect
        .poll(() =>
          experience
            .locator(`[data-path-position="${position}"]`)
            .evaluate((element) => Number(getComputedStyle(element).opacity)),
        )
        .toBeGreaterThan(0.8);
    }
  }
  await experience.getByRole('button', { name: 'Pause Menti motion' }).focus();
  await page.mouse.move(0, 0);
  if ((page.viewportSize()?.width ?? 0) > 1100) {
    await expect(experience).toHaveAttribute('data-active-position', '');
    await expect
      .poll(() =>
        pupils.evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).m41,
        ),
      )
      .toBe(0);
    await experience.locator('[data-module-id="ai-career"]').hover();
    await expect(experience).toHaveAttribute('data-active-position', '2');
    await expect
      .poll(() =>
        pupils.evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).m41,
        ),
      )
      .toBeLessThan(-0.1);
    await page.mouse.move(0, 0);
    await expect(experience).toHaveAttribute('data-active-position', '');
    await expect
      .poll(() =>
        pupils.evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).m41,
        ),
      )
      .toBe(0);
  }
  expect(
    await hero.evaluate((element) => [
      element.style.getPropertyValue('--menti-gaze-x'),
      element.style.getPropertyValue('--menti-gaze-y'),
    ]),
  ).toEqual(heroGaze);
});

test('Coming Soon stays unavailable and other undelivered pathways retain honest dialogs and no-JavaScript content', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto('/#programs');
  const section = page.locator('#programs');
  for (const card of await section.locator('.module-card--soon').all()) {
    await expect(card).toContainText('Coming Soon');
    await expect(card.locator('a, button, [tabindex]')).toHaveCount(0);
  }
  for (const id of ['entrepreneurship', 'career-counsellor']) {
    const action = section.locator(`[data-module-id="${id}"].module-card`);
    await action.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', {
      name: programs.find((program) => program.id === id)!.name,
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('No applications are being accepted');
    await page.keyboard.press('Escape');
    await expect(action).toBeFocused();
  }
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: page.viewportSize()!,
  });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto(`${baseURL}/#programs`);
    for (const card of await staticPage
      .locator('#programs .module-card')
      .all()) {
      await card.evaluate((element) =>
        element.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
      await expect(card).toBeVisible();
    }
    await staticPage
      .locator('#programs [data-module-id="entrepreneurship"]')
      .click();
    await expect(
      staticPage.locator('#module-entrepreneurship-availability'),
    ).toBeVisible();
    await expect(
      staticPage.locator('#module-entrepreneurship-availability'),
    ).toContainText('No applications are being accepted');
    // Activate the native fragment link directly: JavaScript-disabled Chromium
    // can stall Playwright's RAF stability check after a smooth anchor scroll.
    await staticPage
      .locator('#module-entrepreneurship-availability a')
      .evaluate((element) => (element as HTMLAnchorElement).click());
    await expect(staticPage).toHaveURL(`${baseURL}/#programs`);
    await expect(
      staticPage.locator('#programs .menti-character'),
    ).toBeVisible();
    await expect(
      staticPage.getByRole('button', { name: 'Next module' }),
    ).toBeHidden();
    expect(
      await staticPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  } finally {
    await context.close();
  }
});

test('pause and reduced motion stop Menti movement while preserving focus highlights and accessibility', async ({
  page,
}) => {
  await page.goto('/#programs');
  const section = page.locator('#programs');
  const experience = section.locator('.module-experience');
  await expect(experience).toHaveAttribute('data-enhanced', 'true');
  const motion = experience.getByRole('button', { name: 'Pause Menti motion' });
  await motion.click();
  await expect(experience).toHaveAttribute('data-motion-paused', 'true');
  expect(
    await experience
      .locator('.menti-character')
      .evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === 'running').length,
      ),
  ).toBe(0);
  await experience.getByRole('button', { name: 'Resume Menti motion' }).click();
  const action = experience.locator('[data-module-position="2"] .module-card');
  await action.focus();
  await expect(experience).toHaveAttribute('data-active-position', '2');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(motion).toBeHidden();
  await expect
    .poll(() =>
      experience
        .locator('.menti-pupils')
        .evaluate((element) => getComputedStyle(element).transform),
    )
    .toBe('none');
  await expect(experience).toHaveAttribute('data-active-position', '2');
  await expect(action).toBeFocused();
  expect(
    await experience
      .locator('.menti-character')
      .evaluate((element) => element.getAnimations({ subtree: true }).length),
  ).toBe(0);
  expect(
    await experience
      .locator('[data-module-position="2"] img')
      .evaluate((element) => getComputedStyle(element).transform),
  ).toBe('none');
  expect(
    (
      await new AxeBuilder({ page })
        .include('#programs')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test('user-controlled carousel follows buttons and touch swipes through all seven positions', async ({
  page,
}, testInfo) => {
  test.skip(
    (testInfo.project.use.viewport?.width ?? 0) > 1100,
    'Desktop uses the orbital layout.',
  );
  await page.goto('/#programs');
  const experience = page.locator('.module-experience');
  const next = experience.getByRole('button', { name: 'Next module' });
  const previous = experience.getByRole('button', { name: 'Previous module' });
  const status = experience.locator('.module-carousel-status');
  await expect(previous).toBeDisabled();
  await next.click();
  await expect(status).toContainText('02');
  await expect(experience).toHaveAttribute('data-active-position', '2');
  const track = experience.locator('.module-discovery');
  await track.scrollIntoViewIfNeeded();
  const bounds = await track.boundingBox();
  const client = await page.context().newCDPSession(page);
  const y = bounds!.y + 80;
  const from = bounds!.x + bounds!.width * 0.82;
  const to = bounds!.x + bounds!.width * 0.15;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from, y }],
  });
  for (let step = 1; step <= 12; step++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from + ((to - from) * step) / 12, y }],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect.poll(() => status.innerText()).not.toContain('02');
  // Wait for native touch inertia and snapping before starting another scroll.
  await track.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        let previous = element.scrollLeft;
        let settled = 0;
        const check = () => {
          const next = element.scrollLeft;
          settled = Math.abs(next - previous) < 0.1 ? settled + 1 : 0;
          previous = next;
          if (settled >= 5) resolve();
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
  );
  for (let position = 3; position <= 7; position++) {
    // Explicit scroll represents the same native rail behavior after a swipe; no auto-rotation.
    await track.evaluate((element, position) => {
      const slot = element.querySelector(
        `[data-module-position="${position}"]`,
      )!;
      element.scrollTo({
        left:
          element.scrollLeft +
          slot.getBoundingClientRect().left -
          element.getBoundingClientRect().left,
        behavior: 'instant',
      });
    }, position);
    await expect(experience).toHaveAttribute(
      'data-active-position',
      String(position),
    );
    await expect(status).toContainText(String(position).padStart(2, '0'));
  }
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(status).toContainText('06');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
