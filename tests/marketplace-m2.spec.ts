import { test, expect, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { testDatabaseUrl } from './helpers/d4-database';
import { randomUUID } from 'node:crypto';
import { programPageSnapshotInput } from '../src/lib/marketplace/page-validation';

test.describe.configure({ mode: 'serial' });
let db: PrismaClient;
let fullOffering: { id: string; revision: string };
const origin = 'http://127.0.0.1:3113';
const captureDirectory = 'docs/reviews/marketplace-m2';
const captured: string[] = [];
const fullSlug = 'm2-review-ai-foundations';
const basicSlug = 'm2-review-basic-program';
const partialSlug = 'm2-review-partial-program';
const draftSentinels = [
  'M2_DRAFT_ONLY_EYEBROW',
  'M2_DRAFT_ONLY_HEADLINE',
  'M2_DRAFT_ONLY_SUMMARY',
  'M2_DRAFT_ONLY_SEO_TITLE',
  'M2_DRAFT_ONLY_SEO_DESCRIPTION',
  'M2_DRAFT_ONLY_SECTION_BODY',
];

async function publishFixtureSnapshot(offeringId: string) {
  const draft = await db.marketplaceOfferingPage.findUniqueOrThrow({
    where: { offeringId },
    include: { sections: { orderBy: { position: 'asc' } } },
  });
  const snapshotJson = programPageSnapshotInput.parse({
    schemaVersion: 1,
    settings: {
      eyebrow: draft.eyebrow,
      heroHeadline: draft.heroHeadline,
      heroSummary: draft.heroSummary,
      seoTitle: draft.seoTitle,
      seoDescription: draft.seoDescription,
    },
    sections: draft.sections.map((section) => ({
      type: section.type,
      title: section.title,
      subtitle: section.subtitle,
      enabled: section.enabled,
      content: section.contentJson,
    })),
  });
  // Privileged fixture setup targets only the already-guarded disposable Test schema.
  await db.$transaction(async (transaction) => {
    await transaction.marketplaceOfferingPageVersion.create({
      data: { pageId: offeringId, revision: draft.revision, snapshotJson },
    });
    await transaction.marketplaceOfferingPage.update({
      where: { offeringId },
      data: { publishedRevision: draft.revision },
    });
  });
}

const offeringData = (slug: string, title: string) => ({
  slug,
  title,
  shortDescription:
    'Explore practical ideas through structured learning, guided projects and thoughtful career preparation.',
  category: 'Technology and careers',
  deliveryMode: 'ONLINE' as const,
  durationLabel: '12 weeks',
  priceMinor: 1500000,
  currency: 'INR',
  availabilityStatus: 'COMING_SOON' as const,
  publicationStatus: 'PUBLISHED' as const,
  publishedAt: new Date('2026-11-18T10:00:00Z'),
  featured: true,
});

test.beforeAll(async () => {
  if (!/^d4_[a-f0-9]{24}$/.test(process.env.D4_TEST_SCHEMA || ''))
    throw Error('An isolated local Test schema is required.');
  db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: testDatabaseUrl()! },
      { schema: process.env.D4_TEST_SCHEMA! },
    ),
  });
  fullOffering = await db.marketplaceOffering.create({
    data: {
      ...offeringData(fullSlug, 'M2 Design & AI Foundations'),
      cardImage: '/images/homepage/careerignite.webp',
      heroImage: '/images/collaboration.webp',
      cohortStartsAt: new Date('2027-01-15T09:00:00Z'),
      page: {
        create: {
          eyebrow: 'A practical starting point',
          heroHeadline: 'Build what comes next',
          heroSummary:
            'Develop a considered foundation in emerging technology, creative problem solving and the skills to turn an idea into a useful project.',
          seoTitle: 'M2 AI Foundations — editorial SEO title',
          seoDescription:
            'An Admin-authored description for the M2 program page SEO review.',
          sections: {
            create: [
              {
                type: 'OVERVIEW',
                title: 'A foundation for your next chapter',
                subtitle: 'Learn with structure, make room for possibility.',
                position: 0,
                contentJson: {
                  body: 'Connect new ideas to practical work. This program introduces a clear learning structure and space to explore your own questions.\n\nWork through concepts, practice with examples and bring your learning together in a guided project.',
                },
              },
              {
                type: 'HIGHLIGHTS',
                title: 'Program highlights',
                position: 1,
                contentJson: {
                  items: [
                    'Practical guided projects',
                    'A structured learning sequence',
                    'Time for reflection and exploration',
                    'Ideas connected to everyday situations',
                  ],
                },
              },
              {
                type: 'OUTCOMES',
                title: 'What you will explore',
                position: 2,
                contentJson: {
                  items: [
                    'Explain core concepts in your own words.',
                    'Use a thoughtful process to develop and test an idea.',
                    'Present your work with clarity and confidence.',
                  ],
                },
              },
              {
                type: 'CURRICULUM',
                title: 'Inside the learning journey',
                subtitle: 'An overview of the program curriculum.',
                position: 3,
                contentJson: {
                  modules: [
                    {
                      title: 'Foundations and possibilities',
                      description:
                        'Build a shared vocabulary, examine real-world examples and learn to ask useful questions about emerging technology.',
                    },
                    {
                      title: 'From an idea to a working direction',
                      description:
                        'Explore a practical problem, sketch possible approaches and make deliberate decisions as your project takes shape. Document what you tried, what you learned and how you would improve it.',
                    },
                    {
                      title: 'Making your learning visible',
                      description:
                        'Bring your process and outcomes together in a clear project presentation.',
                    },
                  ],
                },
              },
              {
                type: 'WHO_IS_IT_FOR',
                title: 'Who this program is for',
                position: 4,
                contentJson: {
                  items: [
                    'Learners curious about technology and creative problem solving.',
                    'People looking for a structured way to explore a new direction.',
                  ],
                },
              },
              {
                type: 'ELIGIBILITY',
                title: 'Before you begin',
                position: 5,
                contentJson: {
                  items: [
                    'An interest in exploring new ideas.',
                    'Time to engage with the program activities.',
                  ],
                },
              },
              {
                type: 'FAQ',
                title: 'Your questions, answered',
                position: 6,
                contentJson: {
                  items: [
                    {
                      question: 'Can I enroll through this page?',
                      answer:
                        'Enrollment is not available on this website yet. This page shares program information only.',
                    },
                    {
                      question: 'Where can I see the program structure?',
                      answer:
                        'The curriculum section above outlines the topics and the intended learning sequence.',
                    },
                  ],
                },
              },
              {
                type: 'TEXT',
                title: 'A note about this program',
                position: 7,
                contentJson: {
                  body: 'The published program information is managed by MentoraLM. Check this page for future updates.',
                },
              },
              {
                type: 'TEXT',
                title: 'M2 disabled section should stay private',
                position: 8,
                enabled: false,
                contentJson: { body: 'M2 unpublished editorial note' },
              },
            ],
          },
        },
      },
    },
    select: { id: true, revision: true },
  });
  await publishFixtureSnapshot(fullOffering.id);
  await db.marketplaceOfferingPage.update({
    where: { offeringId: fullOffering.id },
    data: {
      eyebrow: draftSentinels[0],
      heroHeadline: draftSentinels[1],
      heroSummary: draftSentinels[2],
      seoTitle: draftSentinels[3],
      seoDescription: draftSentinels[4],
      revision: randomUUID(),
    },
  });
  await db.marketplaceOfferingSection.updateMany({
    where: { pageId: fullOffering.id, type: 'OVERVIEW' },
    data: { contentJson: { body: draftSentinels[5] } },
  });
  await db.marketplaceOffering.create({
    data: {
      ...offeringData(basicSlug, 'M2 Basic Program'),
      availabilityStatus: 'OPEN',
      priceMinor: 0,
      deliveryMode: 'HYBRID',
    },
  });
  await db.marketplaceOffering.create({
    data: {
      ...offeringData(partialSlug, 'M2 Partial Program'),
      availabilityStatus: 'WAITLIST',
      priceMinor: null,
      page: {
        create: {
          heroHeadline: 'M2_DRAFT_ONLY_PARTIAL_HEADLINE',
          heroSummary: 'M2_DRAFT_ONLY_PARTIAL_SUMMARY',
          seoTitle: 'M2_DRAFT_ONLY_PARTIAL_SEO_TITLE',
          seoDescription: 'M2_DRAFT_ONLY_PARTIAL_SEO_DESCRIPTION',
          sections: {
            create: {
              type: 'TEXT',
              title: 'Disabled partial editorial content',
              enabled: false,
              position: 0,
              contentJson: {
                body: 'This disabled content must not be public.',
              },
            },
          },
        },
      },
    },
  });
  for (const status of ['DRAFT', 'UNPUBLISHED', 'ARCHIVED'] as const) {
    const privateOffering = await db.marketplaceOffering.create({
      data: {
        ...offeringData(
          `m2-private-${status.toLowerCase()}`,
          `M2 private ${status}`,
        ),
        publicationStatus: status,
        publishedAt: status === 'DRAFT' ? null : new Date(),
        page: {
          create: {
            seoTitle: `M2 hidden SEO ${status}`,
            heroHeadline: `M2 hidden headline ${status}`,
          },
        },
      },
    });
    await publishFixtureSnapshot(privateOffering.id);
  }
});

test.afterAll(async () => {
  await db?.$disconnect();
  await mkdir(captureDirectory, { recursive: true });
  await writeFile(
    `${captureDirectory}/public-capture-manifest.json`,
    JSON.stringify({ captures: captured }, null, 2) + '\n',
  );
});

async function noOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
    clippedText: [
      ...document.querySelectorAll<HTMLElement>(
        'main h1, main h2, main h3, main p, main summary, main dd',
      ),
    ]
      .filter(
        (element) =>
          element.getClientRects().length &&
          element.scrollWidth > element.clientWidth + 1,
      )
      .map((element) => element.className),
  }));
  expect(layout.width, 'No horizontal document overflow').toBeLessThanOrEqual(
    layout.viewport,
  );
  expect(layout.clippedText, 'Program text must wrap without clipping').toEqual(
    [],
  );
}

async function capture(page: Page, name: string, axe = false) {
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.locator('.site-header [aria-label="Loading account"]:visible'),
  ).toHaveCount(0);
  await noOverflow(page);
  if (axe)
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  await mkdir(captureDirectory, { recursive: true });
  await page.screenshot({
    path: `${captureDirectory}/${name}.png`,
    fullPage: true,
  });
  captured.push(`${name}.png`);
}

test('Published data resolves with ordered sections, SEO overrides, FAQ keyboard behavior and safe public projection', async ({
  page,
  request,
}) => {
  const response = await page.goto(`/courses/${fullSlug}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'Build what comes next', exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-program-section] > header h2')).toHaveText([
    'A foundation for your next chapter',
    'Program highlights',
    'What you will explore',
    'Inside the learning journey',
    'Who this program is for',
    'Before you begin',
    'Your questions, answered',
    'A note about this program',
  ]);
  await expect(
    page.getByText('M2 disabled section should stay private'),
  ).toHaveCount(0);
  await expect(page.getByText('M2 unpublished editorial note')).toHaveCount(0);
  await expect(page).toHaveTitle('M2 AI Foundations — editorial SEO title');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'An Admin-authored description for the M2 program page SEO review.',
  );
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    `${origin}/courses/${fullSlug}`,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'M2 AI Foundations — editorial SEO title',
  );
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    'content',
    'M2 AI Foundations — editorial SEO title',
  );
  const source = await (await request.get(`/courses/${fullSlug}`)).text();
  expect(source).not.toContain(fullOffering.id);
  expect(source).not.toContain(fullOffering.revision);
  expect(source).not.toContain('courseRef');
  expect(source).not.toContain('lmsEnabled');
  expect(source).not.toContain('publicationStatus');
  expect(source).not.toContain('M2 unpublished editorial note');
  for (const sentinel of draftSentinels) expect(source).not.toContain(sentinel);
  expect(source).not.toContain('publishedRevision');
  expect(source).toContain('Connect new ideas to practical work.');
  const question = page.locator('.program-faq-item').first();
  await question.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(question).toHaveAttribute('open', '');
  await expect(question.locator('p')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(question).not.toHaveAttribute('open');
  await expect(question.locator('summary')).toBeFocused();
});

test('all non-Published and unknown slugs return the same private 404 behavior', async ({
  page,
  request,
}) => {
  for (const slug of [
    'm2-private-draft',
    'm2-private-unpublished',
    'm2-private-archived',
    'm2-does-not-exist',
  ]) {
    const response = await request.get(`/courses/${slug}`, {
      headers: { 'user-agent': 'Googlebot' },
    });
    expect(response.status(), slug).toBe(404);
    const html = await response.text();
    expect(html).not.toContain('M2 hidden SEO');
    expect(html).not.toContain('M2 hidden headline');
    expect(html).not.toContain('M2 private DRAFT');
    expect(html).not.toContain('M2 private UNPUBLISHED');
    expect(html).not.toContain('M2 private ARCHIVED');
    const browserResponse = await page.goto(`/courses/${slug}`);
    expect(browserResponse?.status(), `Normal browser ${slug}`).toBe(404);
    await expect(page.getByRole('heading', { name: /404/ })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
    await expect(page.locator('body')).not.toContainText('M2 hidden headline');
    await expect(page).not.toHaveTitle(/M2 hidden SEO/);
  }
});

test('basic and partial Published pages have honest status, fallback artwork and metadata fallbacks', async ({
  page,
  request,
}) => {
  await page.goto(`/courses/${basicSlug}`);
  await expect(
    page.getByRole('heading', { name: 'M2 Basic Program', level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveTitle('M2 Basic Program | MentoraLM');
  await expect(page.locator('meta[name=description]')).toHaveAttribute(
    'content',
    offeringData(basicSlug, '').shortDescription,
  );
  await expect(page.locator('.program-basic-overview')).toBeVisible();
  await expect(page.locator('.program-hero-art.is-fallback')).toBeVisible();
  await expect(page.locator('.program-summary-price strong')).toHaveText(
    '₹0.00',
  );
  await expect(page.locator('.program-hero .program-action-label')).toHaveText(
    'Enroll Now',
  );
  await expect(
    page
      .locator('main')
      .getByRole('button', { name: 'Enroll Now', exact: true }),
  ).toHaveCount(2);
  await capture(page, '1440-program-basic', true);
  await db.marketplaceOffering.update({
    where: { slug: basicSlug },
    data: { availabilityStatus: 'CLOSED' },
  });
  try {
    await page.reload();
    await expect(
      page.locator('.program-hero .program-action-label'),
    ).toHaveText('Enrollment Closed');
    await expect(page.locator('.program-hero .program-action-note')).toHaveText(
      'Enrollment is currently closed for this program.',
    );
    await expect(page.locator('.program-availability')).toHaveText('Closed');
  } finally {
    await db.marketplaceOffering.update({
      where: { slug: basicSlug },
      data: { availabilityStatus: 'OPEN' },
    });
  }
  await page.goto(`/courses/${partialSlug}`);
  await expect(
    page.getByRole('heading', { name: 'M2 Partial Program', level: 1 }),
  ).toBeVisible();
  await expect(page.locator('meta[name=description]')).toHaveAttribute(
    'content',
    offeringData(partialSlug, '').shortDescription,
  );
  await expect(page.locator('.program-summary-price strong')).toHaveText(
    'To be announced',
  );
  await expect(page.locator('.program-hero .program-action-label')).toHaveText(
    'Waitlist Coming Soon',
  );
  await expect(page.locator('.program-basic-overview')).toBeVisible();
  await expect(
    page.getByText('This disabled content must not be public.'),
  ).toHaveCount(0);
  await expect(page).toHaveTitle('M2 Partial Program | MentoraLM');
  for (const name of ['og:title', 'twitter:title'])
    await expect(
      page.locator(
        `meta[${name.startsWith('og:') ? 'property' : 'name'}="${name}"]`,
      ),
    ).toHaveAttribute('content', 'M2 Partial Program | MentoraLM');
  const partialSource = await (
    await request.get(`/courses/${partialSlug}`)
  ).text();
  expect(partialSource).not.toContain('M2_DRAFT_ONLY_PARTIAL');

  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, '390-program-partial', true);
});

test('catalogue and homepage cards link to their real Published program routes', async ({
  page,
}) => {
  for (const surface of ['/courses', '/']) {
    await page.goto(surface);
    const card = page.locator('.marketplace-card').filter({
      has: page.getByRole('heading', {
        name: 'M2 Design & AI Foundations',
        exact: true,
      }),
    });
    await expect(
      card.getByRole('link', {
        name: 'View M2 Design & AI Foundations program',
      }),
    ).toHaveAttribute('href', `${origin}/courses/${fullSlug}`);
    await expect(
      card.getByRole('button', { name: 'Details Coming Soon' }),
    ).toHaveCount(0);
  }
  await page
    .locator('.marketplace-card')
    .filter({
      has: page.getByRole('heading', {
        name: 'M2 Design & AI Foundations',
        exact: true,
      }),
    })
    .getByRole('link', { name: 'View M2 Design & AI Foundations program' })
    .click();
  await expect(page).toHaveURL(new RegExp(`/courses/${fullSlug}$`));
  await expect(
    page.getByRole('heading', { name: 'Build what comes next', level: 1 }),
  ).toBeVisible();
});

test('full program layout wraps at every required viewport and keeps FAQ and summary accessible', async ({
  page,
}) => {
  for (const width of [1672, 1440, 1024, 820, 390, 320]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
    await page.goto(`/courses/${fullSlug}`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.program-curriculum li')).toHaveCount(3);
    const summary = page.locator('.program-summary');
    await expect(summary).toHaveCSS(
      'position',
      width > 820 ? 'sticky' : 'static',
    );
    if (width <= 820) {
      const contentBox = await page.locator('.program-content').boundingBox();
      const summaryBox = await summary.boundingBox();
      expect(summaryBox!.y).toBeGreaterThanOrEqual(
        contentBox!.y + contentBox!.height,
      );
    }
    await page.locator('.program-faq-item summary').first().click();
    await expect(page.locator('.program-faq-item').first()).toHaveAttribute(
      'open',
      '',
    );
    await page.evaluate(() => scrollTo(0, 0));
    await capture(
      page,
      `${width}-program-full`,
      [1440, 390, 320].includes(width),
    );
  }
});
