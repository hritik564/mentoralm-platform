import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { journey } from '../src/content/home';

async function openJourney(page: Page) {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.locator('#journey');
  await expect(section.locator('.roadmap-experience')).toHaveAttribute(
    'data-enhanced',
    'true',
  );
  await section.evaluate((el) => {
    history.replaceState(null, '', '#journey');
    scrollTo({
      top: el.getBoundingClientRect().top + scrollY - 104,
      behavior: 'instant',
    });
  });
  return section;
}

test('six readable milestones follow the approved order in a light responsive journey', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const section = await openJourney(page);
  await expect(section.getByRole('heading', { level: 2 })).toHaveText(
    'Where you are today.Where you can go next.',
  );
  await expect(section.locator('.roadmap-experience')).toHaveAttribute(
    'data-enhanced',
    'true',
  );
  await expect(section.locator('.roadmap-card h3')).toHaveText(
    journey.map((step) => step.title),
  );
  await expect(section.locator('.roadmap-card > p')).toHaveText(
    journey.map((step) => step.description),
  );
  const geometry = await section.evaluate((element) => {
    const cards = [...element.querySelectorAll('.roadmap-card')].map((card) =>
      card.getBoundingClientRect(),
    );
    const guide = element
      .querySelector('.roadmap-guide')!
      .getBoundingClientRect();
    const overlaps = (a: DOMRect, b: DOMRect) =>
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top;
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      overlapping: cards.some(
        (card, index) =>
          cards.slice(index + 1).some((other) => overlaps(card, other)) ||
          overlaps(card, guide),
      ),
      textClipped: [
        ...element.querySelectorAll('h2, h3, .roadmap-card > p'),
      ].some((node) => node.scrollWidth > node.clientWidth + 1),
      horizontal: cards
        .slice(1)
        .every((card, index) => card.left > cards[index].left),
      vertical: cards
        .slice(1)
        .every((card, index) => card.top > cards[index].bottom),
      background: getComputedStyle(element).backgroundImage,
      guideWidth: element
        .querySelector('.menti-character')!
        .getBoundingClientRect().width,
    };
  });
  expect(geometry.overflow).toBe(false);
  expect(geometry.overlapping).toBe(false);
  expect(geometry.textClipped).toBe(false);
  expect(geometry.background).toContain('rgb(246, 248, 255)');
  expect(geometry.guideWidth).toBeGreaterThanOrEqual(90);
  const width = page.viewportSize()!.width;
  if (width > 1100) expect(geometry.horizontal).toBe(true);
  if (width <= 700) expect(geometry.vertical).toBe(true);
  await expect(section).toContainText(
    'Guidance and matching are in development.',
  );
});

test('milestone keyboard and tap emphasis is accessible and does not create a new journey', async ({
  page,
}) => {
  const section = await openJourney(page);
  const experience = section.locator('.roadmap-experience');
  const buttons = section.locator('[data-stage-button]');
  await expect(buttons.first()).toBeEnabled();
  await buttons.first().focus();
  for (let index = 0; index < 6; index++) {
    if (index) await page.keyboard.press('Tab');
    const button = buttons.nth(index);
    await expect(button).toBeFocused();
    await expect(experience).toHaveAttribute(
      'data-active-stage',
      journey[index].number,
    );
    expect(
      await button.evaluate(
        (el) => getComputedStyle(el.closest('.roadmap-card')!).outlineWidth,
      ),
    ).toBe('3px');
  }
  await page.keyboard.press('Enter');
  await expect(buttons.last()).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(buttons.last()).toHaveAttribute('aria-pressed', 'false');
  await buttons.nth(2).click();
  await expect(buttons.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(experience).toHaveAttribute('data-active-stage', '03');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/#journey$/);
  if (page.viewportSize()!.width > 1100) {
    await buttons.nth(2).click();
    await section
      .getByRole('button', { name: 'Pause journey motion' })
      .evaluate((el) =>
        (el as HTMLButtonElement).focus({ preventScroll: true }),
      );
    // Settle the native smooth focus scroll before measuring pointer feedback.
    await buttons
      .nth(4)
      .evaluate((el) =>
        el.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
    await buttons.nth(4).hover();
    await expect(experience).toHaveAttribute('data-active-stage', '05');
    await expect
      .poll(() =>
        section
          .locator(
            '.roadmap-route--desktop [data-route-stage="05"] .roadmap-route-highlight',
          )
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBeGreaterThan(0.8);
    await expect
      .poll(() =>
        section
          .locator('.menti-pupils')
          .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41),
      )
      .toBeGreaterThan(0);
    await page.mouse.move(0, 0);
    await expect(experience).toHaveAttribute('data-active-stage', '');
    await expect
      .poll(() =>
        section
          .locator('.menti-pupils')
          .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41),
      )
      .toBe(0);
  }
});

test('journey pause and reduced motion preserve content, static emphasis and protected characters', async ({
  page,
}) => {
  const section = await openJourney(page);
  const experience = section.locator('.roadmap-experience');
  await section.getByRole('button', { name: 'Pause journey motion' }).click();
  await expect(experience).toHaveAttribute('data-motion-paused', 'true');
  expect(
    await section
      .locator('.menti-character')
      .evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await expect(page.locator('.module-experience')).toHaveAttribute(
    'data-motion-paused',
    'false',
  );
  await expect(page.locator('.hero--cinematic')).toHaveAttribute(
    'data-motion-paused',
    'false',
  );
  await section.getByRole('button', { name: 'Resume journey motion' }).click();
  await section.locator('[data-stage-button="04"]').focus();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(
    section.getByRole('button', { name: 'Pause journey motion' }),
  ).toBeHidden();
  await expect(experience).toHaveAttribute('data-active-stage', '04');
  await expect
    .poll(() =>
      section
        .locator('.menti-pupils')
        .evaluate((el) => getComputedStyle(el).transform),
    )
    .toBe('none');
  expect(
    await section.evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await expect(section.locator('.reveal-pending')).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('#journey')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test('the whole roadmap remains readable without JavaScript', async ({
  browser,
  baseURL,
  page,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: page.viewportSize()!,
  });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto(`${baseURL}/#journey`);
    const section = staticPage.locator('#journey');
    await expect(section.locator('.roadmap-card h3')).toHaveText(
      journey.map((step) => step.title),
    );
    for (const card of await section.locator('.roadmap-card').all()) {
      await card.evaluate((el) =>
        el.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
      await expect(card).toBeVisible();
    }
    await expect(section.locator('.reveal-pending')).toHaveCount(0);
    await expect(
      section.getByRole('button', { name: 'Pause journey motion' }),
    ).toBeHidden();
    await expect(section.locator('[data-stage-button]').first()).toBeDisabled();
    expect(
      await staticPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  } finally {
    await context.close();
  }
});

test('real Journey anchors leave the full eyebrow and heading below the sticky rail', async ({
  page,
}) => {
  const assertClearance = async () => {
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        page.locator('#journey').evaluate((section) => {
          const header = document
            .querySelector('.site-header')!
            .getBoundingClientRect();
          const eyebrow = section
            .querySelector('.roadmap-eyebrow')!
            .getBoundingClientRect();
          const heading = section.querySelector('h2')!.getBoundingClientRect();
          return (
            eyebrow.top >= header.bottom + 16 && heading.bottom < innerHeight
          );
        }),
      )
      .toBe(true);
    await expect(page.locator('#journey .reveal-pending')).toHaveCount(0);
  };
  await page.goto('/#journey');
  await assertClearance();
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole('link', {
      name: 'Personalized Learning Paths A direction that fits you',
    })
    .click();
  await expect(page).toHaveURL(/#journey$/);
  await assertClearance();
  if (page.viewportSize()!.width > 1100) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#journey');
    await assertClearance();
  }
});

test('active milestones illuminate the cumulative route while preserving quiet later stages', async ({
  page,
}) => {
  const section = await openJourney(page);
  for (const position of [1, 4, 6]) {
    const button = section.locator(`[data-stage-button="0${position}"]`);
    await button.focus();
    await expect(section.locator('.roadmap-experience')).toHaveAttribute(
      'data-active-stage',
      `0${position}`,
    );
    const width = page.viewportSize()!.width;
    if (width > 700) {
      const route = section.locator(
        width > 1100 ? '.roadmap-route--desktop' : '.roadmap-route--tablet',
      );
      for (let destination = 2; destination <= 6; destination++) {
        const opacity = route.locator(
          `[data-route-stage="0${destination}"] .roadmap-route-highlight`,
        );
        await expect
          .poll(() =>
            opacity.evaluate((el) => Number(getComputedStyle(el).opacity)),
          )
          .toBe(destination <= position ? 0.95 : 0);
      }
    } else {
      for (let source = 1; source <= 5; source++) {
        const segment = section.locator(`[data-stage="0${source}"]`);
        expect(
          await segment.evaluate(
            (el) => getComputedStyle(el, '::after').content,
          ),
        ).toBe(source < position ? '""' : 'none');
      }
    }
    for (let node = 1; node <= 6; node++) {
      await expect(section.locator(`[data-stage="0${node}"]`)).toHaveAttribute(
        'data-reached',
        String(node <= position),
      );
    }
    const direction = await section.evaluate((el, position) => {
      const a = el.querySelector('.menti-character')!.getBoundingClientRect();
      const b = el
        .querySelector(`[data-stage="0${position}"] .roadmap-card`)!
        .getBoundingClientRect();
      const t = new DOMMatrix(
        getComputedStyle(el.querySelector('.menti-pupils')!).transform,
      );
      return {
        x: t.m41,
        y: t.m42,
        dx: b.left + b.width / 2 - a.left - a.width / 2,
        dy: b.top + b.height / 2 - a.top - a.height / 2,
      };
    }, position);
    expect(Math.abs(direction.x)).toBeLessThanOrEqual(2.4);
    expect(Math.abs(direction.y)).toBeLessThanOrEqual(1.8);
    await expect
      .poll(() =>
        section.evaluate((el, position) => {
          const a = el
            .querySelector('.menti-character')!
            .getBoundingClientRect();
          const b = el
            .querySelector(`[data-stage="0${position}"] .roadmap-card`)!
            .getBoundingClientRect();
          const t = new DOMMatrix(
            getComputedStyle(el.querySelector('.menti-pupils')!).transform,
          );
          return (
            t.m41 * (b.left + b.width / 2 - a.left - a.width / 2) +
            t.m42 * (b.top + b.height / 2 - a.top - a.height / 2)
          );
        }, position),
      )
      .toBeGreaterThan(0);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await section.locator('[data-stage-button="04"]').focus();
  await expect(section.locator('.menti-pupils')).toHaveCSS('transform', 'none');
  if (page.viewportSize()!.width > 700) {
    const route = section.locator(
      page.viewportSize()!.width > 1100
        ? '.roadmap-route--desktop'
        : '.roadmap-route--tablet',
    );
    for (let destination = 2; destination <= 6; destination++) {
      await expect(
        route.locator(
          `[data-route-stage="0${destination}"] .roadmap-route-highlight`,
        ),
      ).toHaveCSS('opacity', destination <= 4 ? '0.95' : '0');
    }
  }
});

test('cool opening and warm destination remain distinct with tighter readable surfaces', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const section = await openJourney(page);
  const opening = section.locator('[data-stage="01"] .roadmap-card');
  const destination = section.locator('[data-stage="06"] .roadmap-card');
  const backgrounds = await Promise.all(
    [opening, destination].map((card) =>
      card.evaluate((el) => getComputedStyle(el).backgroundImage),
    ),
  );
  expect(backgrounds[0]).toContain('rgb(237, 241, 247)');
  expect(backgrounds[1]).toContain('rgb(255, 243, 216)');
  expect(
    await destination.evaluate((el) => getComputedStyle(el).borderColor),
  ).toBe('rgb(230, 201, 142)');
  expect(
    await section
      .locator('[data-stage="06"] .roadmap-marker')
      .evaluate((el) => getComputedStyle(el).borderTopWidth),
  ).toBe('2px');
  if (page.viewportSize()!.width > 1100) {
    expect(
      await opening.evaluate((el) => el.getBoundingClientRect().height),
    ).toBeLessThan(270);
    expect(
      await section
        .locator('.roadmap-card > p')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(13);
  }
});
