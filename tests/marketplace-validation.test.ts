import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOfferingInput,
  updateOfferingInput,
  offeringRevisionInput,
  marketplaceListInput,
  publicOfferingsInput,
} from '../src/lib/marketplace/validation';

const offering = {
  title: 'Fixture learning program',
  slug: 'fixture-learning-program',
  shortDescription: 'An editorial test offering.',
  category: 'Technology',
  cardImage: null,
  heroImage: null,
  deliveryMode: 'ONLINE',
  durationLabel: 'Six weeks',
  priceMinor: 1500000,
  currency: 'INR',
  availabilityStatus: 'COMING_SOON',
  featured: false,
  sortOrder: 0,
  lmsEnabled: false,
  courseRef: null,
  cohortStartsAt: null,
};

test('Offering money accepts only bounded nonnegative integer minor units', () => {
  for (const priceMinor of [null, 0, 1, 1500000, 2147483647])
    assert.equal(
      createOfferingInput.safeParse({ ...offering, priceMinor }).success,
      true,
    );
  for (const priceMinor of [
    -1,
    0.01,
    1.5,
    2147483648,
    Infinity,
    NaN,
    '1500000',
  ])
    assert.equal(
      createOfferingInput.safeParse({ ...offering, priceMinor }).success,
      false,
    );
  const { currency: omitted, ...withoutCurrency } = offering;
  assert.equal(omitted, 'INR');
  assert.equal(createOfferingInput.parse(withoutCurrency).currency, 'INR');
  for (const currency of ['IN', 'inr', 'INRR', '<INR>'])
    assert.equal(
      createOfferingInput.safeParse({ ...offering, currency }).success,
      false,
    );
});

test('Create and update reject client-assigned publication, internal or future-commerce fields', () => {
  for (const extra of [
    { publicationStatus: 'PUBLISHED' },
    { publishedAt: '2026-11-18T00:00:00.000Z' },
    { createdAt: '2026-11-18T00:00:00.000Z' },
    { courseId: 'internal-course-id' },
    { checkoutUrl: 'https://example.test/checkout' },
    { enrollment: true },
    { payment: { amount: 1500000 } },
  ])
    assert.equal(
      createOfferingInput.safeParse({ ...offering, ...extra }).success,
      false,
    );
  const revision = '5bc38f20-d1b7-41ea-b5a0-e562259b1f3a';
  assert.equal(
    createOfferingInput.safeParse({ ...offering, revision }).success,
    false,
  );
  assert.equal(updateOfferingInput.safeParse(offering).success, false);
  assert.equal(
    updateOfferingInput.safeParse({ ...offering, revision }).success,
    true,
  );
  assert.equal(
    offeringRevisionInput.safeParse({
      revision,
      publicationStatus: 'PUBLISHED',
    }).success,
    false,
  );
  assert.equal(
    offeringRevisionInput.safeParse({ revision: 'stale-or-forged' }).success,
    false,
  );
});

test('Marketplace images reject remote, SVG, traversal and asset-query input', () => {
  for (const cardImage of [
    'https://example.test/image.webp',
    '//example.test/image.webp',
    '/images/../secret.webp',
    '/images/%2e%2e/secret.webp',
    '/images/campus.webp?download=1',
    '/images/campus.svg',
    'javascript:alert(1)',
    '/api/private-file',
  ])
    assert.equal(
      createOfferingInput.safeParse({ ...offering, cardImage }).success,
      false,
    );
  assert.equal(
    createOfferingInput.safeParse({
      ...offering,
      cardImage: '/images/campus.webp',
    }).success,
    true,
  );
});

test('Plain text, stable slugs, delivery and availability are validated independently', () => {
  for (const title of ['', '   ', '<script>alert(1)</script>', 'Title\u0000'])
    assert.equal(
      createOfferingInput.safeParse({ ...offering, title }).success,
      false,
    );
  for (const slug of [
    'MixedCase',
    '-leading',
    'trailing-',
    'two--hyphens',
    '../path',
    'a'.repeat(101),
  ])
    assert.equal(
      createOfferingInput.safeParse({ ...offering, slug }).success,
      false,
    );
  for (const availabilityStatus of [
    'OPEN',
    'COMING_SOON',
    'WAITLIST',
    'CLOSED',
  ])
    assert.equal(
      createOfferingInput.safeParse({ ...offering, availabilityStatus })
        .success,
      true,
    );
  for (const deliveryMode of ['ONLINE', 'OFFLINE', 'HYBRID'])
    assert.equal(
      createOfferingInput.safeParse({ ...offering, deliveryMode }).success,
      true,
    );
  assert.equal(
    createOfferingInput.safeParse({
      ...offering,
      availabilityStatus: 'PUBLISHED',
    }).success,
    false,
  );
  assert.equal(
    createOfferingInput.safeParse({ ...offering, deliveryMode: 'SELF_PACED' })
      .success,
    false,
  );
  assert.equal(
    createOfferingInput.safeParse({
      ...offering,
      cohortStartsAt: '2026-02-30T00:00:00.000Z',
    }).success,
    false,
  );
});

test('Public pagination is bounded and administrator filters accept only publication states', () => {
  assert.deepEqual(publicOfferingsInput.parse({}), { page: 1, limit: 20 });
  assert.deepEqual(publicOfferingsInput.parse({ featured: true, limit: 6 }), {
    page: 1,
    limit: 6,
    featured: true,
  });
  for (const input of [
    { limit: 0 },
    { limit: 21 },
    { page: 0 },
    { page: 10001 },
    { status: 'DRAFT' },
  ])
    assert.equal(publicOfferingsInput.safeParse(input).success, false);
  for (const status of ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED', ''])
    assert.equal(marketplaceListInput.safeParse({ status }).success, true);
  assert.equal(
    marketplaceListInput.safeParse({ status: 'OPEN' }).success,
    false,
  );
});
