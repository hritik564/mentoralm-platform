import { programPrice } from '../src/components/marketplace/program/presentation';
import { LocalMutationLimiter } from '../src/lib/student/abuse';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  aboutInput,
  educationInput,
  goalInput,
  onboardingStepInput,
  startIntentInput,
} from '../src/lib/marketplace/enrollment/validation';
import { dashboardDestination } from '../src/lib/auth/redirects';
import { requestBody } from '../src/lib/student/http';
import { testDatabaseUrl } from './helpers/d4-database';
import { migrationManifest } from '../src/lib/production/migrations';
import { requireMarketplaceEnrollmentBaseline } from '../scripts/marketplace/safety';
const about = {
  fullName: 'Synthetic Student',
  phone: '+919876543210',
  city: 'Pune',
  region: 'Maharashtra',
  country: 'India',
};
for (const [name, patch] of Object.entries({
  name: { fullName: '' },
  phone: { phone: '123' },
  city: { city: '' },
  region: { region: '' },
  country: { country: '' },
  longName: { fullName: 'a'.repeat(121) },
  longPhone: { phone: '1'.repeat(33) },
  longCity: { city: 'a'.repeat(101) },
  html: { fullName: '<script>alert(1)</script>' },
  newline: { fullName: 'A\nB' },
  control: { city: 'A\x00B' },
  trailingControl: { fullName: 'Synthetic Student\n' },
  phoneControl: { phone: '+919876543210\n' },
}))
  test(`M3 about-you rejects ${name}`, () => {
    assert.equal(aboutInput.safeParse({ ...about, ...patch }).success, false);
  });
test('M3 strict schemas reject mass assignment, unsupported enums and excess goal/source', () => {
  assert.equal(
    startIntentInput.safeParse({ slug: 'program', priceMinor: 0 }).success,
    false,
  );
  for (const key of [
    'offeringId',
    'userId',
    'state',
    'currency',
    'completedAt',
    'consentVersion',
  ])
    assert.equal(
      onboardingStepInput.safeParse({
        ...about,
        step: 1,
        revision: randomUUID(),
        [key]: 'attacker',
      }).success,
      false,
    );
  assert.equal(
    educationInput.safeParse({
      educationLevel: 'made-up',
      currentStatus: 'STUDENT',
      institution: null,
    }).success,
    false,
  );
  for (const goal of [
    'short',
    'x'.repeat(1501),
    '<b>unsafe goal</b>',
    'contains\tcontrol text',
  ])
    assert.equal(goalInput.safeParse({ goal, source: null }).success, false);
  assert.equal(
    goalInput.safeParse({
      goal: 'A valid synthetic goal',
      source: 'x'.repeat(201),
    }).success,
    false,
  );
});
test('M3 auth destinations retain exact opaque flow routes and reject redirects and queries', () => {
  const ref = randomBytes(32).toString('base64url');
  for (const path of [`/enroll/${ref}`, `/checkout/${ref}`])
    assert.equal(dashboardDestination(path), path);
  for (const path of [
    `https://attacker.invalid/enroll/${ref}`,
    `//attacker.invalid/enroll/${ref}`,
    `/enroll/${ref}?redirect=https://attacker.invalid`,
    `/enroll/${ref}#x`,
    '/enroll/short',
    `/enroll/${ref}\n`,
    `/enroll/${ref}\r`,
    `/checkout/${ref}\u2028`,
    '/checkout/../admin',
    '/%2fenroll/' + ref,
  ])
    assert.equal(dashboardDestination(path), '/dashboard');
});
test('M3 mutation origin, JSON type and request-size protections reject before parsing', async () => {
  for (const headers of [
    { 'content-type': 'application/json', origin: 'https://attacker.invalid' },
    { 'content-type': 'text/plain', origin: 'http://127.0.0.1:3000' },
  ])
    await assert.rejects(
      requestBody(
        new Request('http://127.0.0.1:3000/api/marketplace/enrollment', {
          method: 'POST',
          headers,
          body: '{}',
        }),
      ),
    );
  await assert.rejects(
    requestBody(
      new Request('http://127.0.0.1:3000/api/marketplace/enrollment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://127.0.0.1:3000',
        },
        body: JSON.stringify({ x: 'x'.repeat(17000) }),
      }),
    ),
  );
});
test('M3 API exports only GET/POST, uses private responses and dedicated rate categories', () => {
  const route = readFileSync(
    'src/app/api/marketplace/enrollment/[[...path]]/route.ts',
    'utf8',
  );
  assert.match(route, /route as GET, route as POST/);
  assert.doesNotMatch(route, /export.*(?:PUT|PATCH|DELETE)/);
  assert.match(route, /requestBody/);
  assert.match(route, /privateJson/);
  assert.match(route, /marketplace-start/);
  assert.match(route, /marketplace-onboarding/);
  assert.match(route, /marketplace-anonymous/);
});
test('M3 private domain has no shared public caching, payment or LMS write dependencies', () => {
  for (const file of ['service.ts', 'server.ts', 'page.ts']) {
    const source = readFileSync(
      'src/lib/marketplace/enrollment/' + file,
      'utf8',
    );
    assert.doesNotMatch(
      source,
      /unstable_cache|use cache|marketplace-generation|marketplace\/cache|createEnrollment|stripe|razorpay/,
    );
  }
  for (const path of ['enroll', 'checkout'])
    assert.match(
      readFileSync(`src/app/${path}/[intentRef]/page.tsx`, 'utf8'),
      /force-dynamic/,
    );
});
test('M3 test database guard refuses Development target and nonlocal hosts', () => {
  const before = process.env.TEST_DATABASE_URL;
  try {
    for (const url of [
      'postgresql://invalid:invalid@localhost:5432/mentoralm_dev',
      'postgresql://invalid:invalid@example.invalid:5432/mentoralm_test',
    ]) {
      process.env.TEST_DATABASE_URL = url;
      assert.throws(testDatabaseUrl);
    }
  } finally {
    process.env.TEST_DATABASE_URL = before;
  }
});
test('M3 guarded migration allows only approved enrollment addition over exact M2 prefix', () => {
  const rows = migrationManifest.map((m) => ({
    migration_name: m.name,
    checksum: m.checksum,
    finished_at: new Date(),
    rolled_back_at: null,
  }));
  // Historical M3 tooling must refuse the newly pending M4 migrations.
  assert.throws(() => requireMarketplaceEnrollmentBaseline(rows.slice(0, 17)));
  assert.throws(() => requireMarketplaceEnrollmentBaseline(rows.slice(0, 18)));
  assert.deepEqual(requireMarketplaceEnrollmentBaseline(rows), []);
  for (const bad of [
    [],
    rows.slice(0, -1),
    [...rows, rows[0]],
    [{ ...rows[0], checksum: 'tampered' }],
  ])
    assert.throws(() => requireMarketplaceEnrollmentBaseline(bad));
  const sql = readFileSync(
    'prisma/migrations/20261119090000_marketplace_enrollment_intents/migration.sql',
    'utf8',
  );
  assert.doesNotMatch(sql, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/im);
  assert.equal((sql.match(/CREATE TABLE/g) || []).length, 3);
  assert.equal((sql.match(/CREATE TYPE/g) || []).length, 2);
  assert.doesNotMatch(
    sql,
    /ALTER TABLE "(?:Course|Enrollment|User|StudentProfile)"/,
  );
});

test('M3 dedicated mutation limits allow normal wizard use and reject floods independently', () => {
  const limiter = new LocalMutationLimiter();
  for (let i = 0; i < 20; i++)
    limiter.check('synthetic', 'marketplace-start', 0);
  assert.throws(() => limiter.check('synthetic', 'marketplace-start', 0), {
    code: 'RATE_LIMITED',
  });
  for (let i = 0; i < 60; i++)
    limiter.check('synthetic', 'marketplace-onboarding', 0);
  assert.throws(() => limiter.check('synthetic', 'marketplace-onboarding', 0), {
    code: 'RATE_LIMITED',
  });
  assert.doesNotThrow(() =>
    limiter.check('synthetic', 'marketplace-start', 60001),
  );
});

test('M3 checkout uses the existing currency-minor-unit formatter, including JPY and KWD', () => {
  for (const [currency, priceMinor, expected] of [
    ['INR', 1500000, 15000],
    ['JPY', 15000, 15000],
    ['KWD', 15000501, 15000.501],
  ] as const)
    assert.equal(
      programPrice({ currency, priceMinor }),
      new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(
        expected,
      ),
    );
  assert.equal(programPrice({ currency: 'INR', priceMinor: 0 }), '₹0.00');
});
