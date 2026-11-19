import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { providerFixture } from './helpers/marketplace-m4-provider';
import { RazorpayGateway } from '../src/lib/marketplace/commerce/razorpay';
import {
  commerceResponse,
  paymentWebhook,
} from '../src/lib/marketplace/commerce/http';
import {
  purchasePolicy,
  razorpayGateway,
} from '../src/lib/marketplace/commerce/config';
import { dashboardDestination } from '../src/lib/auth/redirects';
import { adminHref, adminDestination } from '../src/lib/platform/domains';
import {
  adminPathPermission,
  adminPermissions,
} from '../src/lib/admin/permissions';
import {
  visibleAdminNavigation,
  workspaceDestinations,
} from '../src/lib/admin/navigation';
import { LocalMutationLimiter } from '../src/lib/student/abuse';
import { limits } from '../src/lib/student/mutation-policy';
import { migrationManifest } from '../src/lib/production/migrations';
import {
  requireMarketplaceCommerceBaseline,
  requireMarketplaceEnrollmentBaseline,
} from '../scripts/marketplace/safety';
for (const invalid of [
  null,
  '',
  'not-a-signature',
  '0'.repeat(63),
  '0'.repeat(64),
  'f'.repeat(65),
])
  test(`M4 rejects invalid webhook signature shape ${invalid === null ? 'missing' : invalid.length}`, () => {
    const p = providerFixture();
    const headers = new Headers({ 'x-razorpay-event-id': 'evt_fixture' });
    if (invalid !== null) headers.set('x-razorpay-signature', invalid);
    assert.throws(() => p.gateway.verifyWebhook(Buffer.from('{}'), headers), {
      code: 'FORBIDDEN',
    });
  });
test('M4 signatures use exact raw bytes; malformed signed body, missing event ID and foreign merchant rejected', () => {
  const p = providerFixture();
  const body = {
    account_id: p.config.merchantRef,
    event: 'order.paid',
    payload: { order: { entity: { id: 'order_fixture' } } },
  };
  const raw = Buffer.from(JSON.stringify(body)),
    headers = new Headers({
      'x-razorpay-event-id': 'evt_valid',
      'x-razorpay-signature': createHmac('sha256', p.config.webhookSecrets[0])
        .update(raw)
        .digest('hex'),
    });
  assert.equal(
    p.gateway.verifyWebhook(raw, headers).sessionId,
    'order_fixture',
  );
  assert.throws(
    () => p.gateway.verifyWebhook(Buffer.from(raw.toString() + ' '), headers),
    { code: 'FORBIDDEN' },
  );
  headers.delete('x-razorpay-event-id');
  assert.throws(() => p.gateway.verifyWebhook(raw, headers), {
    code: 'INVALID_INPUT',
  });
  for (const input of [
    '{',
    '{}',
    JSON.stringify({ ...body, account_id: 'acc_foreign' }),
  ]) {
    const bytes = Buffer.from(input);
    headers.set('x-razorpay-event-id', 'evt_valid');
    headers.set(
      'x-razorpay-signature',
      createHmac('sha256', p.config.webhookSecrets[0])
        .update(bytes)
        .digest('hex'),
    );
    assert.throws(() => p.gateway.verifyWebhook(bytes, headers));
  }
});
test('M4 Checkout signature is computed from server session ID and never accepts client-paid claims', () => {
  const p = providerFixture(),
    data = {
      razorpay_order_id: 'order_server',
      razorpay_payment_id: 'pay_fixture',
      razorpay_signature: p.returnSignature('order_server', 'pay_fixture'),
    };
  assert.doesNotThrow(() => p.gateway.verifyReturn('order_server', data));
  assert.throws(() => p.gateway.verifyReturn('order_other', data), {
    code: 'FORBIDDEN',
  });
  assert.throws(
    () => p.gateway.verifyReturn('order_server', { ...data, paid: true }),
    { code: 'FORBIDDEN' },
  );
});
test('M4 bounded raw webhook rejects oversized and non-JSON requests before service mutation', async () => {
  let calls = 0;
  const service = {
    consumeWebhook: async () => {
      calls++;
    },
  };
  for (const request of [
    new Request('http://localhost/hook', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    }),
    new Request('http://localhost/hook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'x'.repeat(65537),
    }),
  ]) {
    const response = await commerceResponse(() =>
      paymentWebhook(request, service),
    );
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});
test('M4 webhook has no Clerk/CSRF gate; ownership APIs and returns retain session/origin validation', () => {
  const webhook = readFileSync(
    'src/app/api/payments/razorpay/webhook/route.ts',
    'utf8',
  );
  assert.doesNotMatch(
    webhook,
    /enrollmentActor|requireAdminActor|requestBody|sameOrigin/,
  );
  assert.match(webhook, /paymentWebhook/);
  const api = readFileSync(
    'src/app/api/marketplace/commerce/[[...path]]/route.ts',
    'utf8',
  );
  assert.match(api, /enrollmentActor/);
  assert.match(api, /requestBody/);
  assert.match(api, /commerce-payment/);
  assert.match(api, /route as GET, route as POST/);
  assert.doesNotMatch(api, /route as PUT|route as DELETE|route as PATCH/);
});
test('M4 production credentials and unapproved terms cannot activate checkout', () => {
  const original = { ...process.env };
  try {
    for (const version of ['', 'invented', 'toString', '__proto__']) {
      process.env.MARKETPLACE_PURCHASE_TERMS_VERSION = version;
      assert.equal(purchasePolicy(), null);
    }
    delete process.env.RAZORPAY_KEY_ID;
    assert.throws(razorpayGateway, { code: 'UNAVAILABLE' });
    process.env.RAZORPAY_KEY_ID = [
      'rzp',
      '_',
      'live',
      '_',
      'SyntheticOnly',
    ].join('');
    assert.throws(razorpayGateway, { code: 'UNAVAILABLE' });
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});
test('M4 adapter refuses zero/subminimum/unsupported currency without rounding', async () => {
  const p = providerFixture();
  for (const [minor, currency] of [
    [0, 'INR'],
    [99, 'INR'],
    [100, 'USD'],
    [100001, 'KWD'],
    [1.5, 'INR'],
  ] as const) {
    assert.equal(p.gateway.supports(minor, currency), false);
    await assert.rejects(
      p.gateway.createSession({
        receipt: crypto.randomUUID(),
        amountMinor: minor,
        currency,
      }),
      { code: 'CONFLICT' },
    );
  }
  assert.equal(p.creates, 0);
});
test('M4 transport refuses redirects/oversized/non-JSON provider replies and exposes only safe errors', async () => {
  const fixture = providerFixture();
  for (const response of [
    () => new Response('x'.repeat(262145)),
    () => new Response('not json'),
    () => new Response('{}', { status: 401 }),
  ]) {
    const g = new RazorpayGateway(fixture.config, async () => response());
    await assert.rejects(g.recoverSession(crypto.randomUUID()), {
      code: 'UNAVAILABLE',
    });
  }
});
test('M4 source uses one claim and receipt recovery, without invented universal idempotency headers', () => {
  const adapter = readFileSync(
      'src/lib/marketplace/commerce/razorpay.ts',
      'utf8',
    ),
    service = readFileSync('src/lib/marketplace/commerce/payments.ts', 'utf8');
  assert.match(service, /status: 'CREATED'/);
  assert.match(service, /CREATING/);
  assert.match(service, /recoverSession/);
  assert.match(adapter, /receipt=/);
  assert.doesNotMatch(
    adapter,
    /X-Payout-Idempotency|X-Refund-Idempotency|Idempotency-Key/,
  );
});
test('M4 exact Order redirects remain closed and financial routes require COMMERCE_VIEW', () => {
  const ref = randomBytes(32).toString('base64url');
  assert.equal(dashboardDestination(`/orders/${ref}`), `/orders/${ref}`);
  assert.equal(
    adminDestination(`/admin/marketplace/orders/${ref}`),
    `/admin/marketplace/orders/${ref}`,
  );
  assert.ok(adminHref(`/admin/marketplace/orders/${ref}`));
  assert.equal(
    adminPathPermission(`/admin/marketplace/orders/${ref}`),
    'COMMERCE_VIEW',
  );
  for (const path of [
    `/orders/${ref}?paid=true`,
    `/orders/${ref}\n`,
    `https://attacker.invalid/orders/${ref}`,
    '/admin/marketplace/orders/../users',
  ]) {
    if (path.startsWith('/admin'))
      assert.equal(adminDestination(path), '/admin');
    else assert.equal(dashboardDestination(path), '/dashboard');
  }
});
test('M4 catalogue/academic editors receive no financial access; commerce-only navigation stays in Marketplace', () => {
  assert.ok(adminPermissions.includes('COMMERCE_VIEW'));
  assert.ok(adminPermissions.includes('COMMERCE_MANAGE'));
  for (const permissions of [
    ['MARKETPLACE_MANAGE'],
    ['ACADEMICS_MANAGE'],
  ] as const)
    assert.ok(
      !workspaceDestinations('marketplace', permissions).some((d) =>
        d.href.includes('/orders'),
      ),
    );
  const nav = visibleAdminNavigation(['COMMERCE_VIEW']);
  assert.equal(
    nav.find((n) => n.id === 'marketplace')?.href,
    '/admin/marketplace/orders',
  );
});
test('M4 per-browser and User limits precede a high emergency circuit; no client or spoofed IP identity', () => {
  const limiter = new LocalMutationLimiter();
  assert.ok(limits['marketplace-anonymous'] >= 10000);
  for (let i = 0; i < 20; i++)
    limiter.check('server-issued-browser', 'marketplace-start', 0);
  assert.throws(
    () => limiter.check('server-issued-browser', 'marketplace-start', 0),
    { code: 'RATE_LIMITED' },
  );
  for (let i = 0; i < 20; i++)
    limiter.check('server-user', 'commerce-payment', 0);
  assert.throws(() => limiter.check('server-user', 'commerce-payment', 0), {
    code: 'RATE_LIMITED',
  });
  const route = readFileSync(
    'src/app/api/marketplace/enrollment/[[...path]]/route.ts',
    'utf8',
  );
  assert.ok(
    route.indexOf("'marketplace-start'") <
      route.indexOf("'marketplace-anonymous'"),
  );
  assert.doesNotMatch(route, /x-forwarded-for|x-real-ip/);
  const proof = readFileSync(
    'src/lib/marketplace/enrollment/server.ts',
    'utf8',
  );
  assert.match(proof, /createHmac/);
  assert.match(proof, /timingSafeEqual/);
});
test('M4 private modules do not use shared public cache or create learning grants', () => {
  for (const file of [
    'orders.ts',
    'payments.ts',
    'settlement.ts',
    'retention.ts',
    'admin.ts',
  ]) {
    const source = readFileSync(`src/lib/marketplace/commerce/${file}`, 'utf8');
    assert.doesNotMatch(
      source,
      /unstable_cache|use cache|marketplace-generation|\.enrollment\.create|\.lessonState\.(create|update)|\.batchMembership\.create/,
    );
  }
  const dto = readFileSync('src/lib/marketplace/commerce/orders.ts', 'utf8')
    .split('export function orderDTO')[1]
    .split('export class')[0];
  assert.doesNotMatch(
    dto,
    /merchantRef|providerPaymentId|keySecret|browserHash|fullName|phone|goal/,
  );
});
test('M4 additive migration keeps every historical checksum; old task commands refuse pending commerce work', () => {
  const rows = migrationManifest.map((m) => ({
    migration_name: m.name,
    checksum: m.checksum,
    finished_at: new Date(),
    rolled_back_at: null,
  }));
  // M4 migration commands must refuse newly pending M5 work.
  assert.throws(() => requireMarketplaceCommerceBaseline(rows.slice(0, 18)));
  assert.throws(() => requireMarketplaceCommerceBaseline(rows.slice(0, 20)));
  assert.deepEqual(requireMarketplaceCommerceBaseline(rows), []);
  assert.throws(() => requireMarketplaceEnrollmentBaseline(rows.slice(0, 20)));
  assert.throws(() => requireMarketplaceCommerceBaseline(rows.slice(0, 19)));
  const sql = readFileSync(
    'prisma/migrations/20261119101000_marketplace_commerce/migration.sql',
    'utf8',
  );
  assert.doesNotMatch(sql, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/im);
  assert.equal((sql.match(/CREATE TABLE/g) || []).length, 5);
  assert.match(sql, /marketplace_one_active_entitlement/);
  assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/);
});
