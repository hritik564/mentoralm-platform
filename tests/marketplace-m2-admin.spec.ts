import { test, expect, type Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { testDatabaseUrl } from './helpers/d4-database';
import { signInTestAccount, refreshTestSession } from './helpers/clerk-session';
import {
  offeringInput,
  pageSettings,
  overviewSection,
} from './helpers/marketplace-m2';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
let db: PrismaClient;
const origin = 'http://127.0.0.1:3113';
test.beforeAll(async () => {
  if (
    !/^d4_[a-f0-9]{24}$/.test(process.env.D4_TEST_SCHEMA || '') ||
    !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')
  )
    throw Error('Isolated Test schema and Development Clerk required.');
  await clerkSetup();
  db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: testDatabaseUrl()! },
      { schema: process.env.D4_TEST_SCHEMA! },
    ),
  });
});
test.afterAll(async () => {
  await db?.$disconnect();
});
async function capture(page: Page, name: string, axe = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (axe)
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  await mkdir('docs/reviews/marketplace-m2', { recursive: true });
  await page.screenshot({
    path: `docs/reviews/marketplace-m2/${name}.png`,
    fullPage: true,
  });
}

test('authorized owner saves page drafts and explicitly publishes complete versions; security and offering lifecycle remain enforced', async ({
  page,
  context,
}) => {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }),
    owners = await clerk.users.getUserList({
      emailAddress: ['arcaderobo3@gmail.com'],
      limit: 2,
    });
  expect(owners.data).toHaveLength(1);
  const owner = await db.user.findUniqueOrThrow({
    where: { clerkUserId: owners.data[0].id },
  });
  let sessionId: string | null = null;
  let ref = '';
  let publicPage: Page | null = null;
  const revisedSettings = {
    ...pageSettings,
    heroHeadline: 'Build your next chapter with confidence',
    seoTitle: 'M2 Revised Program | MentoraLM',
    seoDescription:
      'A revised editorial description published as one consistent page version.',
  };
  const snapshot = {
    enrollments: await db.enrollment.count(),
    courses: await db.course.count(),
    memberships: await db.batchMembership.count(),
    override: owner.lmsAccessOverride,
  };
  try {
    await setupClerkTestingToken({ page });
    await page.goto('/');
    await signInTestAccount(page, owners.data[0].id);
    sessionId = await page.evaluate(
      () =>
        (window as unknown as { Clerk: { session: { id: string } } }).Clerk
          .session.id,
    );
    await refreshTestSession(page);
    const create = await context.request.post('/api/admin/marketplace', {
      headers: { origin },
      data: offeringInput('m2-admin-ui'),
    });
    expect(create.status()).toBe(200);
    ref = (await create.json()).ref;
    publicPage = await context.newPage();
    const getPage = () =>
      context.request.get(`/api/admin/marketplace/${ref}/page`);
    const offeringAction = async (
      action: 'publish' | 'unpublish' | 'archive',
    ) => {
      const offering = await (
        await context.request.get(`/api/admin/marketplace/${ref}`)
      ).json();
      expect(
        (
          await context.request.post(
            `/api/admin/marketplace/${ref}/${action}`,
            {
              headers: { origin },
              data: { revision: offering.revision },
            },
          )
        ).status(),
      ).toBe(200);
    };
    const expectInitialPublishedPage = async () => {
      await publicPage!.goto('/courses/m2-admin-ui');
      await expect(
        publicPage!.getByRole('heading', {
          name: pageSettings.heroHeadline!,
          level: 1,
        }),
      ).toBeVisible();
      await expect(publicPage!).toHaveTitle(pageSettings.seoTitle!);
      await expect(
        publicPage!.locator('[data-program-section] > header h2'),
      ).toHaveText([
        'A practical overview',
        'Learning outcomes',
        'The learning journey',
        'Program questions',
      ]);
      await expect(
        publicPage!.getByText('A focused introduction to the public program.'),
      ).toBeVisible();
    };

    await page.goto(`/admin/marketplace/${ref}`);
    await expect(
      page.getByRole('heading', { name: 'M2 Isolated Program', level: 1 }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Program page', exact: true })
      .click();
    await expect(
      page.getByText('No custom sections in this draft yet.', { exact: false }),
    ).toBeVisible();
    await expect(
      page
        .locator('.marketplace-editorial-state')
        .getByText('No published custom content', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Publish Page Changes', exact: true }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'Edit page settings', exact: true })
      .click();
    await page
      .getByLabel('Hero headline', { exact: true })
      .fill(pageSettings.heroHeadline!);
    await page
      .getByLabel('Hero summary', { exact: true })
      .fill(pageSettings.heroSummary!);
    await page
      .getByLabel('SEO title', { exact: true })
      .fill(pageSettings.seoTitle!);
    await page
      .getByLabel('SEO description', { exact: true })
      .fill(pageSettings.seoDescription!);
    await capture(page, '1440-admin-page-settings-light', true);
    await page
      .getByRole('button', { name: 'Save Page Draft', exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Page draft saved.' }),
    ).toBeVisible();
    const addSection = async (type: string, title: string) => {
      await page
        .getByRole('button', { name: 'Add section', exact: true })
        .click();
      await page.getByLabel('Section type', { exact: true }).selectOption(type);
      await page.getByLabel('Section title', { exact: true }).fill(title);
    };
    await addSection('OVERVIEW', 'A practical overview');
    await page
      .getByLabel('Body', { exact: true })
      .fill('A focused introduction to the public program.');
    await page
      .getByRole('button', { name: 'Save Section Draft', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'A practical overview', level: 3 }),
    ).toBeVisible();
    await addSection('OUTCOMES', 'Learning outcomes');
    await page
      .getByRole('button', { name: 'Add outcome', exact: true })
      .click();
    await page
      .getByLabel('Outcome 1', { exact: true })
      .fill('Build practical skills');
    await page
      .getByRole('button', { name: 'Save Section Draft', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Learning outcomes', level: 3 }),
    ).toBeVisible();
    await addSection('CURRICULUM', 'The learning journey');
    await page.getByRole('button', { name: 'Add module', exact: true }).click();
    await page
      .getByLabel('Module title 1', { exact: true })
      .fill('Foundations');
    await page
      .getByLabel('Module description 1', { exact: true })
      .fill('Build a clear foundation through practice.');
    await page
      .getByRole('button', { name: 'Save Section Draft', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'The learning journey', level: 3 }),
    ).toBeVisible();
    await addSection('FAQ', 'Program questions');
    await page.getByRole('button', { name: 'Add FAQ', exact: true }).click();
    await page
      .getByLabel('Question 1', { exact: true })
      .fill('When can I enroll?');
    await page
      .getByLabel('Answer 1', { exact: true })
      .fill('Enrollment is coming soon.');
    await capture(page, '1440-admin-faq-editor-light', true);
    await page
      .getByRole('button', { name: 'Save Section Draft', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Program questions', level: 3 }),
    ).toBeVisible();
    await expect(
      page.locator('.marketplace-editorial-state').getByText('Draft changes', {
        exact: true,
      }),
    ).toBeVisible();
    await offeringAction('publish');
    await publicPage.goto('/courses/m2-admin-ui');
    await expect(
      publicPage.getByRole('heading', {
        name: 'M2 Isolated Program',
        level: 1,
      }),
    ).toBeVisible();
    await expect(publicPage).toHaveTitle('M2 Isolated Program | MentoraLM');
    await expect(publicPage.locator('[data-program-section]')).toHaveCount(0);
    await expect(
      publicPage.locator('meta[name="description"]'),
    ).toHaveAttribute('content', offeringInput('m2-admin-ui').shortDescription);
    const draftOnlySource = await (
      await context.request.get('/courses/m2-admin-ui')
    ).text();
    for (const draftValue of [
      ...Object.values(pageSettings),
      'A practical overview',
      'A focused introduction to the public program.',
      'Learning outcomes',
      'The learning journey',
      'Program questions',
    ])
      expect(draftOnlySource).not.toContain(draftValue);
    await page.reload();
    await page
      .getByRole('button', { name: 'Program page', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Publish Page Changes', exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Page changes published.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Publish Page Changes', exact: true }),
    ).toBeDisabled();
    await expectInitialPublishedPage();
    await capture(page, '1440-admin-page-published-light', true);
    const initialPublished = await (await getPage()).json();
    expect(initialPublished.editorialStatus).toBe('PUBLISHED');
    expect(initialPublished.hasDraftChanges).toBe(false);
    await page
      .getByRole('button', { name: 'Edit page settings', exact: true })
      .click();
    await page
      .getByLabel('Hero headline', { exact: true })
      .fill(revisedSettings.heroHeadline);
    await page
      .getByLabel('SEO title', { exact: true })
      .fill(revisedSettings.seoTitle);
    await page
      .getByLabel('SEO description', { exact: true })
      .fill(revisedSettings.seoDescription);
    await page
      .getByRole('button', { name: 'Save Page Draft', exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Page draft saved.' }),
    ).toBeVisible();
    await expectInitialPublishedPage();
    await page
      .getByRole('button', { name: 'Edit A practical overview', exact: true })
      .click();
    await page
      .getByLabel('Body', { exact: true })
      .fill('Updated structured overview content.');
    await page
      .getByRole('button', { name: 'Save Section Draft', exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Section draft saved.' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Move Program questions up', exact: true })
      .click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Draft section order saved.' }),
    ).toBeVisible();
    await expect(page.locator('.marketplace-section-list h3')).toHaveText([
      'A practical overview',
      'Learning outcomes',
      'Program questions',
      'The learning journey',
    ]);
    await page
      .getByRole('button', { name: 'Disable Learning outcomes', exact: true })
      .click();
    await expect(
      page.getByRole('button', {
        name: 'Enable Learning outcomes',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .locator('.marketplace-editorial-state')
        .getByText('Draft changes since last publish', { exact: true }),
    ).toBeVisible();
    await expectInitialPublishedPage();
    const pendingSource = await (
      await context.request.get('/courses/m2-admin-ui')
    ).text();
    for (const draftValue of [
      revisedSettings.heroHeadline,
      revisedSettings.seoTitle,
      revisedSettings.seoDescription,
      'Updated structured overview content.',
    ])
      expect(pendingSource).not.toContain(draftValue);
    await capture(page, '1440-admin-sections-light', true);
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await capture(page, '1440-admin-sections-dark', true);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, '390-admin-sections-dark', true);
    await page.setViewportSize({ width: 320, height: 844 });
    await capture(page, '320-admin-sections-dark');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await refreshTestSession(page);
    let current = await (await getPage()).json();
    for (const [data, headers, status] of [
      [
        { ...revisedSettings, revision: current.revision },
        { origin: 'https://untrusted.example.test' },
        403,
      ],
      [
        { ...revisedSettings, revision: current.revision, actorId: owner.id },
        { origin },
        400,
      ],
      [
        {
          ...overviewSection,
          revision: current.revision,
          content: { body: '<script>bad</script>' },
        },
        { origin },
        400,
      ],
    ] as const) {
      const path = 'content' in data ? 'sections' : 'settings';
      expect(
        (
          await context.request.post(
            `/api/admin/marketplace/${ref}/page/${path}`,
            { headers, data },
          )
        ).status(),
      ).toBe(status);
    }
    const stale = current.revision;
    expect(
      (
        await context.request.post(
          `/api/admin/marketplace/${ref}/page/settings`,
          {
            headers: { origin },
            data: { ...revisedSettings, revision: stale },
          },
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await context.request.post(
          `/api/admin/marketplace/${ref}/page/settings`,
          {
            headers: { origin },
            data: { ...revisedSettings, revision: stale },
          },
        )
      ).status(),
    ).toBe(409);
    expect(
      (
        await context.request.post(
          `/api/admin/marketplace/${ref}/page/publish`,
          {
            headers: { origin },
            data: { revision: stale },
          },
        )
      ).status(),
    ).toBe(409);
    current = await (await getPage()).json();
    expect(
      (
        await context.request.post(
          `/api/admin/marketplace/${ref}/page/sections`,
          {
            headers: { origin },
            data: {
              ...overviewSection,
              revision: current.revision,
              content: { body: 'a'.repeat(66000) },
            },
          },
        )
      ).status(),
    ).toBe(400);
    await db.adminAuthorization.update({
      where: { userId: owner.id },
      data: { permissions: ['ACADEMICS_MANAGE'] },
    });
    expect((await getPage()).status()).toBe(403);
    expect(
      (
        await context.request.post(
          `/api/admin/marketplace/${ref}/page/settings`,
          {
            headers: { origin },
            data: { ...revisedSettings, revision: current.revision },
          },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await context.request.post(
          `/api/admin/marketplace/${ref}/page/publish`,
          {
            headers: { origin },
            data: { revision: current.revision },
          },
        )
      ).status(),
    ).toBe(403);
    await db.adminAuthorization.update({
      where: { userId: owner.id },
      data: { permissions: ['MARKETPLACE_MANAGE'] },
    });
    await expectInitialPublishedPage();
    await page.goto(`/admin/marketplace/${ref}`);
    await page
      .getByRole('button', { name: 'Program page', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Publish Page Changes', exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Page changes published.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Publish Page Changes', exact: true }),
    ).toBeDisabled();
    await capture(page, '1440-admin-page-published-dark', true);
    await publicPage.goto('/courses/m2-admin-ui');
    await expect(
      publicPage.getByRole('heading', {
        name: revisedSettings.heroHeadline,
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      publicPage.locator('[data-program-section] > header h2'),
    ).toHaveText([
      'A practical overview',
      'Program questions',
      'The learning journey',
    ]);
    await expect(
      publicPage.getByText('Updated structured overview content.'),
    ).toBeVisible();
    await expect(publicPage).toHaveTitle(revisedSettings.seoTitle);
    await expect(
      publicPage.locator('meta[name="description"]'),
    ).toHaveAttribute('content', revisedSettings.seoDescription);
    await expect(
      publicPage.locator('meta[property="og:title"]'),
    ).toHaveAttribute('content', revisedSettings.seoTitle);
    await expect(
      publicPage.locator('meta[name="twitter:title"]'),
    ).toHaveAttribute('content', revisedSettings.seoTitle);
    const published = await (await getPage()).json();
    expect(published.editorialStatus).toBe('PUBLISHED');
    expect(published.hasDraftChanges).toBe(false);
    const storedOffering = await db.marketplaceOffering.findUniqueOrThrow({
      where: { slug: 'm2-admin-ui' },
    });
    expect(
      await db.marketplaceOfferingPageVersion.count({
        where: { pageId: storedOffering.id },
      }),
    ).toBe(2);
    await offeringAction('unpublish');
    expect((await publicPage.goto('/courses/m2-admin-ui'))?.status()).toBe(404);
    await offeringAction('publish');
    await publicPage.goto('/courses/m2-admin-ui');
    await expect(
      publicPage.getByRole('heading', {
        name: revisedSettings.heroHeadline,
        level: 1,
      }),
    ).toBeVisible();
    await expect(publicPage).toHaveTitle(revisedSettings.seoTitle);
    await offeringAction('archive');
    expect((await publicPage.goto('/courses/m2-admin-ui'))?.status()).toBe(404);
    expect(
      await db.marketplaceOfferingPageVersion.count({
        where: { pageId: storedOffering.id },
      }),
    ).toBe(2);
    expect({
      enrollments: await db.enrollment.count(),
      courses: await db.course.count(),
      memberships: await db.batchMembership.count(),
      override: (await db.user.findUniqueOrThrow({ where: { id: owner.id } }))
        .lmsAccessOverride,
    }).toEqual(snapshot);
  } finally {
    await publicPage?.close();
    await db.adminAuthorization.update({
      where: { userId: owner.id },
      data: { permissions: ['MARKETPLACE_MANAGE'] },
    });
    if (sessionId)
      await clerk.sessions.revokeSession(sessionId).catch(() => {});
  }
});
