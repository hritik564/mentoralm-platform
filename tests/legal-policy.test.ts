import 'next/dist/server/node-environment-baseline';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { terms20261119 } from '../src/content/legal/terms-2026-11-19-v1';
import { privacy20261119 } from '../src/content/legal/privacy-2026-11-19-v1';
import { legalBlocks } from '../src/lib/legal/document';
import {
  purchaseTerms,
  purchasePolicy,
} from '../src/lib/marketplace/commerce/config';
import { isolatedDatabase } from './helpers/d4-database';
import { readyPurchase } from './helpers/marketplace-m4';
import { CommerceOrders } from '../src/lib/marketplace/commerce/orders';

for (const [name, source, hash, sections] of [
  [
    'terms',
    terms20261119,
    '080bf7904da91ca402875f5d569e147a75ff223af882709d71b9fecec696a5cd',
    24,
  ],
  [
    'privacy',
    privacy20261119,
    'cd669a8b3fdc5bd8144675d9be12ee5cbff0665e556940e5fe34bde50fc4ec0d',
    18,
  ],
] as const) {
  test(`Owner-approved ${name} source exact content digest, identity and version`, () => {
    assert.equal(
      createHash('sha256').update(source.markdown).digest('hex'),
      hash,
    );
    assert.equal(source.version, '2026-11-19-v1');
    assert.equal(source.effectiveDate, '19 November 2026');
    for (const text of [
      '19 November 2026',
      '2026-11-19-v1',
      'MentoraLM Private Limited',
      'U85500KA2026PTC223099',
      'F No. H603, Rohan Upvan Apt, Avalahalli Main Road, Bangalore, Karnataka 560077, India',
      'care@mentoralm.com',
      '+91 8147319393',
      'Munish Lokare',
    ])
      assert.ok(source.markdown.includes(text));
    const blocks = legalBlocks(source.markdown);
    assert.equal(
      blocks.filter((b) => b.kind === 'heading' && b.level === 1).length,
      1,
    );
    assert.equal(
      blocks.filter((b) => b.kind === 'heading' && b.level === 2).length,
      sections,
    );
    // The renderer's grammar consumes all substantive text, rather than dropping clauses.
    const visible = blocks
      .flatMap((b) => (b.kind === 'list' ? b.items : [b.text]))
      .join(' ');
    const normalize = (v: string) =>
      v
        .replace(/^#{1,3} |^(?:- |\d+\. )/gm, '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    assert.equal(normalize(visible), normalize(source.markdown));
    const route = readFileSync(`src/app/${name}/page.tsx`, 'utf8');
    assert.ok(route.includes(`@/content/legal/${name}-2026-11-19-v1`));
    assert.ok(route.includes(`markdown={${name}20261119.markdown}`));
    assert.match(route, /force-static/);
    assert.doesNotMatch(route, /auth\(|prisma|fetch\(|headers\(|cookies\(/);
  });
}
test('Refund text is the approved seven-day request window, not a guarantee', () => {
  assert.ok(
    terms20261119.markdown.includes(
      'within 7 calendar days from the date of purchase',
    ),
  );
  assert.ok(
    terms20261119.markdown.includes(
      'not automatically create a right to a refund',
    ),
  );
  assert.doesNotMatch(terms20261119.markdown, /7.day money.back guarantee/i);
});
test('Exact frozen registry resolves only explicitly selected approved versions', () => {
  const before = process.env.MARKETPLACE_PURCHASE_TERMS_VERSION;
  try {
    assert.deepEqual(purchaseTerms, {
      '2026-11-19-v1': { termsPath: '/terms', privacyPath: '/privacy' },
    });
    assert.ok(Object.isFrozen(purchaseTerms));
    assert.ok(Object.isFrozen(purchaseTerms['2026-11-19-v1']));
    process.env.MARKETPLACE_PURCHASE_TERMS_VERSION = '2026-11-19-v1';
    assert.deepEqual(purchasePolicy(), {
      version: '2026-11-19-v1',
      termsPath: '/terms',
      privacyPath: '/privacy',
    });
    for (const version of ['', 'unknown', 'toString', '__proto__']) {
      process.env.MARKETPLACE_PURCHASE_TERMS_VERSION = version;
      assert.equal(purchasePolicy(), null);
    }
    delete process.env.MARKETPLACE_PURCHASE_TERMS_VERSION;
    assert.equal(purchasePolicy(), null);
  } finally {
    if (before === undefined)
      delete process.env.MARKETPLACE_PURCHASE_TERMS_VERSION;
    else process.env.MARKETPLACE_PURCHASE_TERMS_VERSION = before;
  }
});
test('Legal source and wrapper have no customer/provider data dependencies or obsolete footer notices', () => {
  const wrapper = readFileSync(
    'src/components/legal/LegalDocument.tsx',
    'utf8',
  );
  assert.doesNotMatch(
    wrapper,
    /dangerouslySetInnerHTML|useUser|auth\(|prisma|process\.env|fetch\(/,
  );
  const footer = readFileSync('src/components/layout/Footer.tsx', 'utf8');
  assert.match(footer, /href="\/terms"/);
  assert.match(footer, /href="\/privacy"/);
  assert.doesNotMatch(footer, /notices\.legal/);
  assert.doesNotMatch(
    readFileSync('src/content/home.ts', 'utf8'),
    /Policies are being prepared|Approved privacy and terms documents will be published/,
  );
});
test('Approved policy requires explicit consent and persists exact Order version in isolated PostgreSQL', async () => {
  const f = await isolatedDatabase();
  const before = process.env.MARKETPLACE_PURCHASE_TERMS_VERSION;
  try {
    process.env.MARKETPLACE_PURCHASE_TERMS_VERSION = '2026-11-19-v1';
    const policy = purchasePolicy()!;
    const p = await readyPurchase(f.db);
    const orders = new CommerceOrders(f.db);
    const input = { ...p.input, termsVersion: policy.version };
    await assert.rejects(
      orders.create(p.userId, { ...input, acknowledge: false }, policy),
      { code: 'INVALID_INPUT' },
    );
    const { acknowledge: omitted, ...withoutConsent } = input;
    void omitted;
    await assert.rejects(orders.create(p.userId, withoutConsent, policy), {
      code: 'INVALID_INPUT',
    });
    await assert.rejects(
      orders.create(p.userId, { ...input, termsVersion: 'unknown' }, policy),
      { code: 'UNAVAILABLE' },
    );
    const order = await orders.create(p.userId, input, policy);
    const saved = await f.db.marketplaceOrder.findUniqueOrThrow({
      where: { publicRef: order.ref },
    });
    assert.equal(saved.termsVersion, '2026-11-19-v1');
    process.env.MARKETPLACE_PURCHASE_TERMS_VERSION = 'unknown';
    await assert.rejects(orders.create(p.userId, input, purchasePolicy()), {
      code: 'UNAVAILABLE',
    });
    assert.deepEqual(
      await f.db.marketplaceOrder.findUniqueOrThrow({
        where: { id: saved.id },
      }),
      saved,
    );
  } finally {
    if (before === undefined)
      delete process.env.MARKETPLACE_PURCHASE_TERMS_VERSION;
    else process.env.MARKETPLACE_PURCHASE_TERMS_VERSION = before;
    await f.cleanup();
  }
});
