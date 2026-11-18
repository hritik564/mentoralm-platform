import { test, expect, type Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { testDatabaseUrl } from './helpers/d4-database';
import { signInTestAccount, refreshTestSession } from './helpers/clerk-session';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { OfferingInput } from '../src/lib/marketplace/types';

test.describe.configure({ mode: 'serial' });
let db: PrismaClient;
const origin = 'http://127.0.0.1:3113';
const prefix = 'M1 Owner Review';
const sample = (slug: string): OfferingInput => ({
  title: `${prefix} CareerIgnite`,
  slug,
  shortDescription:
    'Build practical skills and career confidence through guided learning and projects.',
  category: 'Career readiness',
  cardImage: '/images/homepage/careerignite.webp',
  heroImage: null,
  deliveryMode: 'ONLINE',
  durationLabel: '12 weeks',
  priceMinor: 1500000,
  currency: 'INR',
  availabilityStatus: 'COMING_SOON',
  featured: true,
  sortOrder: 0,
  lmsEnabled: false,
  courseRef: null,
  cohortStartsAt: '2027-01-15T09:00:00.000Z',
});

test.beforeAll(async () => {
  if (
    !/^d4_[a-f0-9]{24}$/.test(process.env.D4_TEST_SCHEMA || '') ||
    !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')
  )
    throw Error(
      'Isolated local Test schema and Development identity required.',
    );
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

async function noOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    overflowing: [
      ...document.querySelectorAll<HTMLElement>('main *, .admin-content *'),
    ]
      .filter(
        (element) =>
          element.getClientRects().length &&
          element.getBoundingClientRect().right > innerWidth + 1,
      )
      .slice(0, 20)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        right: Math.round(element.getBoundingClientRect().right),
        width: Math.round(element.getBoundingClientRect().width),
      })),
  }));
  expect(
    layout.width,
    `No document overflow: ${JSON.stringify(layout.overflowing)}`,
  ).toBeLessThanOrEqual(layout.viewport);
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
  await mkdir('docs/reviews/marketplace-m1', { recursive: true });
  // Only public pages or the Marketplace workspace is captured; no account menu or auth form.
  await page.screenshot({
    path: `docs/reviews/marketplace-m1/${name}.png`,
    fullPage: true,
  });
}

test('empty Marketplace and anonymous Admin mutation boundaries are intentional', async ({
  page,
  request,
}) => {
  await page.goto('/courses');
  await expect(
    page.getByRole('heading', { name: 'Courses & Programs', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Your next chapter is taking shape' }),
  ).toBeVisible();
  await expect(page.locator('.marketplace-card')).toHaveCount(0);
  await capture(page, '1440-catalogue-empty', true);
  await page.goto('/');
  await expect(
    page
      .locator('#programs')
      .getByRole('heading', { name: /Explore MentoraLM Courses & Programs/ }),
  ).toBeVisible();
  await expect(
    page
      .locator('#programs')
      .getByRole('heading', { name: 'Your next chapter is taking shape' }),
  ).toBeVisible();
  await expect(page.locator('#programs .marketplace-card')).toHaveCount(0);
  expect((await request.get('/api/admin/marketplace')).status()).toBe(401);
  expect(
    (
      await request.post('/api/admin/marketplace', {
        data: sample('anonymous'),
        headers: { origin },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.get('/api/admin/marketplace', {
        headers: { host: 'untrusted.example.test' },
      })
    ).status(),
  ).toBe(400);
  await page.goto('/admin/marketplace');
  await expect(page).toHaveURL(/admin-auth\/sign-in/);
  expect(await db.marketplaceOffering.count()).toBe(0);
});

test('Admin creates, edits, publishes, unpublishes and archives through existing authenticated UI', async ({
  page,
  context,
}) => {
  const backend = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  const owners = await backend.users.getUserList({
    emailAddress: ['arcaderobo3@gmail.com'],
    limit: 2,
  });
  expect(owners.data).toHaveLength(1);
  const owner = await db.user.findUniqueOrThrow({
    where: { clerkUserId: owners.data[0].id },
  });
  let sessionId: string | null = null;
  let policyChanged = false;
  const studentBefore = {
    enrollment: await db.enrollment.count(),
    access: owner.lmsAccessOverride,
    membership: await db.batchMembership.count(),
    courses: await db.course.count(),
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
    await page.goto('/admin/marketplace');
    await refreshTestSession(page);
    await expect(
      page.getByRole('heading', { name: 'No marketplace offerings yet' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'New Offering', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'New Offering', exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('Title', { exact: true })
      .fill(`${prefix} CareerIgnite`);
    await page
      .getByLabel('Slug', { exact: false })
      .fill('owner-review-careerignite');
    await page.locator('[name=category]').fill('Career readiness');
    await page
      .getByLabel('Short description', { exact: true })
      .fill(sample('x').shortDescription);
    await page
      .getByLabel('Card image (optional)', { exact: false })
      .selectOption('/images/homepage/careerignite.webp');
    await page.getByLabel('Price', { exact: true }).fill('15000');
    await page.locator('[name=durationLabel]').fill('12 weeks');
    await page.getByLabel('Feature on the homepage', { exact: false }).check();
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(page).toHaveURL(
      (url) =>
        /^\/admin\/marketplace\/[A-Za-z0-9_-]+$/.test(url.pathname) &&
        !url.pathname.endsWith('/new'),
    );
    const ref = new URL(page.url()).pathname.split('/').at(-1)!;
    await expect(
      page.getByRole('heading', {
        name: `${prefix} CareerIgnite`,
        exact: true,
      }),
    ).toBeVisible();
    let row = await db.marketplaceOffering.findUniqueOrThrow({
      where: { slug: 'owner-review-careerignite' },
    });
    expect(row.publicationStatus).toBe('DRAFT');
    expect(row.lmsEnabled).toBe(false);
    expect(row.courseId).toBeNull();
    expect(row.priceMinor).toBe(1500000);
    const anonymous = await context.browser()!.newContext();
    try {
      const publicPage = await anonymous.newPage();
      await publicPage.goto(`${origin}/courses`);
      await expect(
        publicPage.getByRole('heading', {
          name: `${prefix} CareerIgnite`,
          exact: true,
        }),
      ).toHaveCount(0);
      await publicPage.close();
    } finally {
      await anonymous.close();
    }
    await page.locator('[name=durationLabel]').fill('14 weeks');
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Publish Offering', exact: true }),
    ).toBeEnabled();
    await page
      .getByRole('button', { name: 'Publish Offering', exact: true })
      .click();
    const publishDialog = page.getByRole('dialog', {
      name: 'Publish this offering?',
    });
    await expect(publishDialog).toBeVisible();
    await publishDialog.getByRole('checkbox').check();
    await publishDialog
      .getByRole('button', { name: 'Publish Offering', exact: true })
      .click();
    await expect(publishDialog).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Unpublish Offering', exact: true }),
    ).toBeVisible();
    row = await db.marketplaceOffering.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(row.publicationStatus).toBe('PUBLISHED');
    expect(row.publishedAt).not.toBeNull();
    expect(row.durationLabel).toBe('14 weeks');
    await capture(page, '1440-admin-offering-published', true);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await capture(page, `${width}-admin-offering-published`, true);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await expect(page.locator('.admin-shell')).toHaveAttribute(
      'data-admin-theme',
      'dark',
    );
    await capture(page, '1440-admin-offering-dark', true);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, '390-admin-offering-dark', true);
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    const api = (
      path: string,
      body: unknown,
      extraHeaders: Record<string, string> = {},
    ) =>
      page.request.post(`/api/admin/marketplace${path}`, {
        data: body,
        headers: { origin, ...extraHeaders },
      });
    expect(
      (
        await api(`/${ref}`, {
          ...sample('owner-review-careerignite'),
          revision: '00000000-0000-4000-8000-000000000000',
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await api(
          `/${ref}/unpublish`,
          { revision: row.revision },
          { origin: 'https://attacker.example.test' },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await api('', {
          ...sample('forged-state'),
          publicationStatus: 'PUBLISHED',
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.put(`/api/admin/marketplace/${ref}`, { data: {} })
      ).status(),
    ).toBe(405);
    expect(
      (
        await page.request.get('/api/admin/marketplace/guessed_internal_id')
      ).status(),
    ).toBe(404);
    await db.adminAuthorization.update({
      where: { userId: owner.id },
      data: { permissions: ['ACADEMICS_MANAGE'] },
    });
    policyChanged = true;
    expect((await api('', sample('academic-only-denied'))).status()).toBe(403);
    expect((await page.request.get('/api/admin/marketplace')).status()).toBe(
      403,
    );
    await db.userRoleAssignment.delete({
      where: { userId_role: { userId: owner.id, role: 'ADMIN' } },
    });
    expect((await api('', sample('student-denied'))).status()).toBe(403);
    await db.userRoleAssignment.create({
      data: { userId: owner.id, role: 'ADMIN' },
    });
    await db.adminAuthorization.update({
      where: { userId: owner.id },
      data: { permissions: ['MARKETPLACE_MANAGE'] },
    });
    policyChanged = false;
    await page.goto('/courses');
    const card = page.getByRole('article', {
      name: `${prefix} CareerIgnite`,
      exact: true,
    });
    await expect(card).toBeVisible();
    await expect(card).toContainText('14 weeks');
    await expect(card).toContainText('Coming soon');
    await expect(card).toContainText('₹15,000');
    await card.getByRole('button', { name: 'Details Coming Soon' }).click();
    await expect(
      page.getByRole('dialog', { name: `${prefix} CareerIgnite`, exact: true }),
    ).toContainText('No application or payment is collected here.');
    await page.keyboard.press('Escape');
    await page.goto('/');
    await expect(
      page
        .locator('#programs')
        .getByRole('article', { name: `${prefix} CareerIgnite`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'MentoraLM programs', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Your Future, Powered by MentoraLM' }),
    ).toBeVisible();
    await expect(
      page
        .locator('.site-header')
        .getByRole('button', { name: /^Open account menu for / })
        .filter({ visible: true }),
    ).toBeVisible();
    expect(
      (
        await api(`/${ref}`, {
          ...sample('owner-review-careerignite'),
          durationLabel: '16 weeks',
          revision: row.revision,
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await expect(
      page.locator('#programs').getByRole('article', {
        name: `${prefix} CareerIgnite`,
        exact: true,
      }),
    ).toContainText('16 weeks');
    await page.goto(`/admin/marketplace/${ref}`);
    await page
      .getByRole('button', { name: 'Unpublish Offering', exact: true })
      .click();
    const unpublish = page.getByRole('dialog', {
      name: 'Unpublish this offering?',
    });
    await unpublish.getByRole('checkbox').check();
    await unpublish
      .getByRole('button', { name: 'Unpublish Offering', exact: true })
      .click();
    await expect(unpublish).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Publish Offering', exact: true }),
    ).toBeVisible();
    await page.goto('/courses');
    await expect(
      page.getByRole('article', {
        name: `${prefix} CareerIgnite`,
        exact: true,
      }),
    ).toHaveCount(0);
    await page.goto('/');
    await expect(
      page
        .locator('#programs')
        .getByRole('heading', { name: 'Your next chapter is taking shape' }),
    ).toBeVisible();
    await expect(
      page
        .locator('#programs')
        .getByRole('article', { name: `${prefix} CareerIgnite`, exact: true }),
    ).toHaveCount(0);
    await page.goto(`/admin/marketplace/${ref}`);
    await page
      .getByRole('button', { name: 'Publish Offering', exact: true })
      .click();
    const republish = page.getByRole('dialog', {
      name: 'Publish this offering?',
    });
    await republish.getByRole('checkbox').check();
    await republish
      .getByRole('button', { name: 'Publish Offering', exact: true })
      .click();
    await expect(republish).toBeHidden();
    await page.goto('/');
    await expect(
      page.locator('#programs').getByRole('article', {
        name: `${prefix} CareerIgnite`,
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(`/admin/marketplace/${ref}`);
    await page
      .getByRole('button', { name: 'Archive Offering', exact: true })
      .click();
    const archive = page.getByRole('dialog', {
      name: 'Archive this offering?',
    });
    await archive.getByRole('checkbox').check();
    await archive
      .getByRole('button', { name: 'Archive Offering', exact: true })
      .click();
    await expect(archive).toBeHidden();
    await expect(page.locator('.marketplace-form-fields')).toHaveAttribute(
      'disabled',
      '',
    );
    await expect(
      page.locator('.marketplace-form-fields [name=title]'),
    ).toBeDisabled();
    expect(
      (
        await db.marketplaceOffering.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).publicationStatus,
    ).toBe('ARCHIVED');
    await page.goto('/');
    await expect(
      page
        .locator('#programs')
        .getByRole('heading', { name: 'Your next chapter is taking shape' }),
    ).toBeVisible();
    await expect(
      page.locator('#programs').getByRole('article', {
        name: `${prefix} CareerIgnite`,
        exact: true,
      }),
    ).toHaveCount(0);
    await page.goto('/courses');
    await expect(
      page.getByRole('article', {
        name: `${prefix} CareerIgnite`,
        exact: true,
      }),
    ).toHaveCount(0);
    await page.goto('/admin/marketplace');
    await page.getByRole('button', { name: 'Archived', exact: true }).click();
    await expect(
      page.getByRole('table', { name: 'Marketplace offerings' }),
    ).toContainText(`${prefix} CareerIgnite`);
    await capture(page, '1440-admin-marketplace-archived', true);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, '390-admin-marketplace-archived', true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    expect(await db.enrollment.count()).toBe(studentBefore.enrollment);
    expect(await db.batchMembership.count()).toBe(studentBefore.membership);
    expect(await db.course.count()).toBe(studentBefore.courses);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: owner.id } }))
        .lmsAccessOverride,
    ).toBe(studentBefore.access);
  } finally {
    if (policyChanged) {
      await db.userRoleAssignment.upsert({
        where: { userId_role: { userId: owner.id, role: 'ADMIN' } },
        create: { userId: owner.id, role: 'ADMIN' },
        update: {},
      });
      await db.adminAuthorization.update({
        where: { userId: owner.id },
        data: { permissions: ['MARKETPLACE_MANAGE'] },
      });
    }
    if (sessionId) await backend.sessions.revokeSession(sessionId);
  }
});

test('published fixtures share one public data source and retain responsive hierarchy at all required widths', async ({
  page,
}) => {
  const titles = [
    'CareerIgnite',
    'YoungMinds AI Lab',
    'GradLM',
    'Career Counsellor Certification',
    'Entrepreneurship',
    'AI-Powered Career Counselling',
    'An additional public offering',
  ];
  await db.marketplaceOffering.createMany({
    data: titles.map((title, index) => {
      const { courseRef: _courseRef, ...input } = sample(
        `visual-fixture-${index}`,
      );
      void _courseRef;
      return {
        ...input,
        id: `m1_visual_${index}`,
        revision: randomUUID(),
        title,
        publicationStatus: 'PUBLISHED' as const,
        publishedAt: new Date(),
        featured: index < 6,
        sortOrder: index + 1,
        cardImage:
          index === 0
            ? '/images/homepage/careerignite.webp'
            : index === 1
              ? '/images/homepage/youngminds-ai-lab.webp'
              : index === 2
                ? '/images/campus.webp'
                : null,
        availabilityStatus: (
          ['OPEN', 'COMING_SOON', 'WAITLIST', 'CLOSED'] as const
        )[index % 4],
        deliveryMode: (['ONLINE', 'OFFLINE', 'HYBRID'] as const)[index % 3],
      };
    }),
  });
  await db.marketplaceOffering.createMany({
    data: (['DRAFT', 'UNPUBLISHED', 'ARCHIVED'] as const).map(
      (publicationStatus, index) => {
        const { courseRef: _courseRef, ...input } = sample(
          `private-fixture-${index}`,
        );
        void _courseRef;
        return {
          ...input,
          id: `m1_private_${index}`,
          revision: randomUUID(),
          title: `Private ${publicationStatus}`,
          publicationStatus,
          sortOrder: 0,
        };
      },
    ),
  });
  const backend = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  const owners = await backend.users.getUserList({
    emailAddress: ['arcaderobo3@gmail.com'],
    limit: 2,
  });
  expect(owners.data).toHaveLength(1);
  let sessionId: string | null = null;
  try {
    await setupClerkTestingToken({ page });
    await page.goto('/');
    await signInTestAccount(page, owners.data[0].id);
    sessionId = await page.evaluate(
      () =>
        (window as unknown as { Clerk: { session: { id: string } } }).Clerk
          .session.id,
    );
    const row = await db.marketplaceOffering.findUniqueOrThrow({
      where: { id: 'm1_visual_0' },
    });
    const listing = await page.request.get(
      '/api/admin/marketplace?q=CareerIgnite&status=PUBLISHED',
    );
    expect(listing.status()).toBe(200);
    const listed = (await listing.json()) as {
      rows: { ref: string; slug: string }[];
    };
    const ref = listed.rows.find((entry) => entry.slug === row.slug)?.ref;
    expect(ref).toBeTruthy();
    const response = await page.request.post(`/api/admin/marketplace/${ref}`, {
      headers: { origin },
      data: {
        ...sample('visual-fixture-0'),
        title: titles[0],
        sortOrder: 1,
        availabilityStatus: 'OPEN',
        revision: row.revision,
      },
    });
    expect(response.status()).toBe(200);
  } finally {
    if (sessionId) await backend.sessions.revokeSession(sessionId);
  }
  // Discard the revoked identity before public visual inspection.
  await page.context().clearCookies();
  for (const width of [1672, 1440, 1024, 820, 390, 320]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
    await page.goto('/courses');
    await expect(page.locator('.marketplace-card')).toHaveCount(7);
    expect(
      await page
        .locator(
          '.marketplace-card h2, .marketplace-card p, .marketplace-card dd, .marketplace-card strong, .marketplace-card button',
        )
        .evaluateAll((elements) =>
          elements
            .filter(
              (element) =>
                element instanceof HTMLElement &&
                ((element.clientWidth > 0 &&
                  element.scrollWidth > element.clientWidth + 1) ||
                  (element.clientHeight > 0 &&
                    element.scrollHeight > element.clientHeight + 1)),
            )
            .map((element) => element.textContent),
        ),
    ).toEqual([]);
    for (const status of ['DRAFT', 'UNPUBLISHED', 'ARCHIVED'])
      await expect(
        page.getByRole('heading', { name: `Private ${status}`, exact: true }),
      ).toHaveCount(0);
    const columns = await page
      .locator('.marketplace-grid')
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length,
      );
    expect(columns).toBe(width > 1024 ? 3 : width > 640 ? 2 : 1);
    expect(
      await page.locator('.marketplace-card a[href^="/courses/"]').count(),
    ).toBe(0);
    await capture(page, `${width}-catalogue-populated`, true);
    await page.goto('/');
    await expect(page.locator('#programs .marketplace-card')).toHaveCount(6);
    await expect(
      page
        .locator('#programs')
        .getByRole('heading', { name: titles[6], exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Your Future, Powered by MentoraLM' }),
    ).toBeVisible();
    await capture(page, `${width}-homepage-marketplace`, true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  const nav = page.getByRole('navigation', {
    name: 'Mobile navigation',
    exact: true,
  });
  await nav.getByRole('button', { name: '01 Courses', exact: true }).click();
  await nav
    .getByRole('link', { name: 'Explore All Courses', exact: true })
    .click();
  await expect(page).toHaveURL(`${origin}/courses`);
  await expect(
    page.getByRole('link', { name: 'MentoraLM home' }).first(),
  ).toHaveAttribute('href', '/');
});

test('public course pages paginate the same published catalogue without exposing internal or private rows', async ({
  page,
}) => {
  const { courseRef: omitted, ...fields } = sample('pagination-base');
  void omitted;
  await db.marketplaceOffering.createMany({
    data: Array.from({ length: 15 }, (_, index) => ({
      ...fields,
      id: `m1_pagination_${index}`,
      revision: randomUUID(),
      slug: `pagination-${index}`,
      title: `Pagination offering ${index}`,
      featured: false,
      sortOrder: index + 100,
      publicationStatus: 'PUBLISHED' as const,
      publishedAt: new Date(),
    })),
  });
  await page.goto('/courses');
  await expect(page.locator('.marketplace-card')).toHaveCount(20);
  await page.getByRole('link', { name: 'Next page', exact: true }).click();
  await expect(page).toHaveURL(/\/courses\?page=2$/);
  await expect(page.locator('.marketplace-card')).toHaveCount(2);
  await expect(
    page.getByRole('link', { name: 'Next page', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Previous page', exact: true }).click();
  await expect(page.locator('.marketplace-card')).toHaveCount(20);
  await noOverflow(page);
});
