import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { providerFixture } from './helpers/marketplace-m4-provider';
import { RazorpayGateway } from '../src/lib/marketplace/commerce/razorpay';
import {
  razorpayAmountIssue,
  paymentUnavailableMessage,
} from '../src/lib/marketplace/commerce/razorpay-amount';
import {
  paymentAvailability,
  purchasePolicy,
  razorpayGateway,
} from '../src/lib/marketplace/commerce/config';
import { paymentWebhook } from '../src/lib/marketplace/commerce/http';
import { logRecord } from '../src/lib/production/log-record';
import { marketplaceDiagnosticCodes } from '../src/lib/marketplace/diagnostics';
import { dashboardDestination } from '../src/lib/auth/redirects';
import { parseMarketplacePrice } from '../src/lib/marketplace/price';

const f = providerFixture();
function signed(raw: Buffer, key: string) {
  return new Headers({
    'content-type': 'application/json',
    'x-razorpay-event-id': 'evt_m6_signature',
    'x-razorpay-signature': createHmac('sha256', key).update(raw).digest('hex'),
  });
}
const raw = Buffer.from(
  JSON.stringify(
    {
      account_id: f.config.merchantRef,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_synthetic', order_id: 'order_synthetic' },
        },
      },
    },
    null,
    2,
  ),
);
for (const key of ['current', 'previous'] as const)
  test(`M6 rotation accepts explicitly configured ${key} secret over exact raw body`, () => {
    const current = 'm6-current-webhook-synthetic-only',
      previous = 'm6-previous-webhook-synthetic-only';
    const gateway = new RazorpayGateway(
      { ...f.config, webhookSecrets: [current, previous] },
      async () => {
        throw Error('No network allowed');
      },
    );
    assert.equal(
      gateway.verifyWebhook(
        raw,
        signed(raw, key === 'current' ? current : previous),
      ).kind,
      'PAYMENT_UPDATED',
    );
  });
test('M6 removing previous secret revokes it; unrelated and transformed raw bodies never validate', () => {
  const current = 'm6-current-webhook-synthetic-only',
    previous = 'm6-previous-webhook-synthetic-only';
  const gateway = new RazorpayGateway(
    { ...f.config, webhookSecrets: [current] },
    async () => {
      throw Error('No network allowed');
    },
  );
  for (const key of [previous, 'unrelated-m6-synthetic-secret'])
    assert.throws(() => gateway.verifyWebhook(raw, signed(raw, key)), {
      code: 'FORBIDDEN',
    });
  assert.throws(
    () =>
      gateway.verifyWebhook(
        Buffer.from(JSON.stringify(JSON.parse(raw.toString()))),
        signed(raw, current),
      ),
    { code: 'FORBIDDEN' },
  );
  assert.throws(() => gateway.verifyWebhook(raw, new Headers()), {
    code: 'FORBIDDEN',
  });
  const malformed = Buffer.from('{not-json');
  assert.throws(
    () => gateway.verifyWebhook(malformed, signed(malformed, current)),
    { code: 'INVALID_INPUT' },
  );
});
test('M6 return signatures bind stored Order; paid flags, forged IDs and another-order signatures are rejected', () => {
  const input = {
    razorpay_order_id: 'order_a',
    razorpay_payment_id: 'pay_a',
    razorpay_signature: f.returnSignature('order_a', 'pay_a'),
  };
  assert.doesNotThrow(() => f.gateway.verifyReturn('order_a', input));
  for (const patch of [
    { paid: true },
    { razorpay_order_id: 'order_b' },
    { razorpay_payment_id: 'pay_b' },
    { razorpay_signature: '0'.repeat(64) },
  ])
    assert.throws(
      () => f.gateway.verifyReturn('order_a', { ...input, ...patch }),
      { code: 'FORBIDDEN' },
    );
  assert.throws(() => f.gateway.verifyReturn('order_b', input), {
    code: 'FORBIDDEN',
  });
});
for (const [minor, currency, expected] of [
  [0, 'INR', 'free-unavailable'],
  [1, 'INR', 'amount-unavailable'],
  [99, 'INR', 'amount-unavailable'],
  [100, 'INR', null],
  [2147483647, 'INR', null],
  [2147483648, 'INR', 'amount-unavailable'],
  [100, 'USD', 'currency-unavailable'],
  [null, 'INR', 'amount-unavailable'],
] as const)
  test(`M6 adapter price admission ${minor}/${currency} is exact and provider-neutral domain receives no conversion`, () => {
    assert.equal(
      razorpayAmountIssue({ priceMinor: minor as number, currency }),
      expected,
    );
    assert.equal(
      f.gateway.supports(minor as number, currency),
      expected === null,
    );
    if (expected) assert.ok(paymentUnavailableMessage(expected).length > 30);
  });
test('M6 decimal prices reject scientific/negative/excess precision/huge values; maximum exact INR survives', () => {
  assert.equal(parseMarketplacePrice('21474836.47', 'INR'), 2147483647);
  for (const value of [
    '-1',
    '1e3',
    '0.001',
    '21474836.48',
    'NaN',
    'Infinity',
    '1,000',
  ])
    assert.throws(() => parseMarketplacePrice(value, 'INR'));
  assert.equal(parseMarketplacePrice('0', 'INR'), 0);
  assert.equal(parseMarketplacePrice('', 'INR'), null);
});
test('M6 missing/unapproved terms and Production payment activation remain fail closed without network', () => {
  const names = [
    'MENTORALM_ENV',
    'MARKETPLACE_PURCHASE_TERMS_VERSION',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'RAZORPAY_ACCOUNT_ID',
  ] as const;
  const old = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  try {
    process.env.MENTORALM_ENV = 'local';
    process.env.MARKETPLACE_PURCHASE_TERMS_VERSION = 'm6-unapproved-terms';
    process.env.RAZORPAY_KEY_ID = f.config.keyId;
    process.env.RAZORPAY_KEY_SECRET = f.config.keySecret;
    process.env.RAZORPAY_WEBHOOK_SECRET = f.config.webhookSecrets[0];
    process.env.RAZORPAY_ACCOUNT_ID = f.config.merchantRef;
    assert.equal(purchasePolicy(), null);
    assert.equal(
      paymentAvailability({ priceMinor: 100, currency: 'INR' }),
      'terms-unavailable',
    );
    assert.equal(
      paymentAvailability({ priceMinor: 0, currency: 'INR' }),
      'free-unavailable',
    );
    process.env.MENTORALM_ENV = 'production';
    assert.throws(razorpayGateway, { code: 'UNAVAILABLE' });
  } finally {
    for (const name of names) {
      if (old[name] === undefined) delete process.env[name];
      else process.env[name] = old[name];
    }
  }
});
test('M6 raw webhook HTTP boundary rejects wrong content type and oversized data before canonical mutation', async () => {
  let calls = 0;
  const payments = {
    consumeWebhook: async () => {
      calls++;
    },
  };
  for (const [type, body] of [
    ['text/plain', '{}'],
    ['application/json', ' '.repeat(65537)],
  ])
    await assert.rejects(
      paymentWebhook(
        new Request('http://127.0.0.1/api/payments/razorpay/webhook', {
          method: 'POST',
          headers: { 'content-type': type },
          body,
        }),
        payments,
      ),
      { code: 'INVALID_INPUT' },
    );
  assert.equal(calls, 0);
});
for (const code of marketplaceDiagnosticCodes)
  test(`M6 structured diagnostic ${code} retains only bounded context`, () => {
    const privateText = 'm6-private-synthetic-value-do-not-log';
    const record = logRecord('warn', 'marketplace_operation', {
      requestId: randomUUID(),
      domain: 'local',
      route: `/api/marketplace/commerce/orders/private-ref?secret=${privateText}`,
      code,
      ...{
        body: privateText,
        authorization: privateText,
        error: Error(privateText),
      },
    });
    assert.equal(record.event, 'marketplace_operation');
    assert.equal(record.code, code);
    assert.equal(record.route, '/api/marketplace/*');
    assert.ok(!JSON.stringify(record).includes(privateText));
    assert.ok(!JSON.stringify(record).includes('private-ref'));
  });
test('M6 diagnostic route families mask provider/enrollment/Order identifiers and reject arbitrary codes', () => {
  for (const route of [
    '/api/payments/razorpay/webhook',
    '/enroll/private-ref',
    '/checkout/private-ref',
    '/orders/private-ref',
  ])
    assert.ok(
      !JSON.stringify(
        logRecord('warn', 'marketplace_operation', {
          route,
          code: 'unknown-private-code',
        }),
      ).includes('private-ref'),
    );
  assert.equal(
    logRecord('warn', 'marketplace_operation', { code: 'unknown-private-code' })
      .code,
    undefined,
  );
});
for (const input of [
  'https://attacker.invalid/checkout/x',
  '//attacker.invalid',
  '/%2F%2Fattacker.invalid',
  '/checkout/../orders/x',
  '/checkout/' + randomBytes(32).toString('base64url') + '?paid=true',
  '/enroll/' + randomBytes(32).toString('base64url') + '#private',
  '/enroll/' +
    randomBytes(32).toString('base64url') +
    '?redirect_url=https://attacker.invalid',
  '/checkout/1',
])
  test(`M6 exact auth return rejects unsafe destination category ${input.split('/')[1] || 'external'}`, () =>
    assert.equal(dashboardDestination(input), '/dashboard'));
test('M6 only exact approved private auth returns survive', () => {
  for (const family of ['enroll', 'checkout', 'orders']) {
    const path = `/${family}/${randomBytes(32).toString('base64url')}`;
    assert.equal(dashboardDestination(path), path);
  }
});
test('M6 no private state is cached and every private route family declares noindex/no canonical', () => {
  for (const path of [
    'src/app/enroll/[intentRef]/page.tsx',
    'src/app/checkout/[intentRef]/page.tsx',
    'src/app/orders/[orderRef]/page.tsx',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /force-dynamic/);
    assert.match(source, /index: false/);
    assert.match(source, /canonical: null/);
    assert.doesNotMatch(source, /unstable_cache|use cache/);
  }
  for (const path of [
    'src/lib/marketplace/enrollment/service.ts',
    'src/lib/marketplace/commerce/orders.ts',
    'src/lib/marketplace/commerce/payments.ts',
    'src/lib/marketplace/delivery/read.ts',
  ])
    assert.doesNotMatch(
      readFileSync(path, 'utf8'),
      /unstable_cache|use cache|\.certificate\.create/,
    );
});

test('M6 structured diagnostic transport failure cannot fail a domain operation', async () => {
  const { marketplaceDiagnostic } =
    await import('../src/lib/marketplace/diagnostics');
  const warn = console.warn;
  try {
    console.warn = () => {
      throw Error('synthetic logger unavailable');
    };
    assert.doesNotThrow(() =>
      marketplaceDiagnostic('MARKETPLACE_DELIVERY_FAILED'),
    );
  } finally {
    console.warn = warn;
  }
});
