import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  MARKETPLACE_GENERATION_KEY,
  MARKETPLACE_PENDING_LIMIT,
  UpstashMarketplaceGeneration,
  marketplaceGenerationScripts,
} from '../src/lib/production/marketplace-generation';
import { upstashCommand } from '../src/lib/production/upstash';
import { TestMarketplaceRedis } from './helpers/marketplace-generation';

async function initialized() {
  const redis = new TestMarketplaceRedis();
  const a = new UpstashMarketplaceGeneration(redis.command);
  const b = new UpstashMarketplaceGeneration(redis.command);
  const epoch = randomUUID();
  await a.initializeAfterQuiescence(null, epoch);
  return { redis, a, b, epoch };
}

test('Shared generation uses primary-routed atomic EVAL and never initializes missing state during normal operations', async () => {
  const redis = new TestMarketplaceRedis();
  const store = new UpstashMarketplaceGeneration(redis.command);
  assert.equal(redis.calls.length, 0);
  assert.equal(await store.snapshot(), null);
  await assert.rejects(store.begin(randomUUID()), { code: 'UNAVAILABLE' });
  assert.equal(redis.hash, null);
  assert.ok(redis.calls.every((command) => command[0] === 'EVAL'));
  assert.ok(
    redis.calls.every((command) => command[3] === MARKETPLACE_GENERATION_KEY),
  );
  assert.ok(!MARKETPLACE_GENERATION_KEY.includes('offering'));
  for (const script of Object.values(marketplaceGenerationScripts)) {
    assert.doesNotMatch(
      script,
      /redis\.call\(['"](?:GET|EXPIRE|PEXPIRE|EVAL_RO)['"]/,
    );
    assert.match(script, /PTTL|EXISTS/);
  }
});

test('Two instances share dirty tokens and each confirmed commit increments exactly once', async () => {
  const { a, b, epoch, redis } = await initialized();
  assert.deepEqual(await b.snapshot(), { epoch, generation: '0', pending: 0 });
  const ticketA = await a.begin(randomUUID());
  const ticketB = await b.begin(randomUUID());
  assert.deepEqual(await b.snapshot(), { epoch, generation: '0', pending: 2 });
  assert.deepEqual(await a.begin(ticketA.token), ticketA);
  assert.equal((await a.snapshot())?.pending, 2);
  await a.commit(ticketA);
  assert.deepEqual(await b.snapshot(), { epoch, generation: '1', pending: 1 });
  await b.commit(ticketA);
  assert.deepEqual(await a.snapshot(), { epoch, generation: '1', pending: 1 });
  await b.commit(ticketB);
  assert.deepEqual(await a.snapshot(), { epoch, generation: '2', pending: 0 });
  assert.equal(redis.hash?.size, 3);
  assert.equal(redis.ttl, -1);
});

test('Known rollback abort removes only its own token without incrementing the generation', async () => {
  const { a, b, epoch } = await initialized();
  const failed = await a.begin(randomUUID());
  const other = await b.begin(randomUUID());
  await a.abort(failed);
  await a.abort(failed);
  assert.deepEqual(await b.snapshot(), { epoch, generation: '0', pending: 1 });
  await b.commit(other);
  assert.deepEqual(await a.snapshot(), { epoch, generation: '1', pending: 0 });
});

test('Unacknowledged begin and postcommit failure retain a dirty marker; retrying a lost commit acknowledgment never double-increments', async () => {
  const { a, b, redis, epoch } = await initialized();
  const token = randomUUID();
  redis.failNext = 'after';
  await assert.rejects(a.begin(token), { code: 'UNAVAILABLE' });
  assert.deepEqual(await b.snapshot(), { epoch, generation: '0', pending: 1 });
  const ticket = await a.begin(token);
  redis.failNext = 'before';
  await assert.rejects(a.commit(ticket), { code: 'UNAVAILABLE' });
  assert.deepEqual(await b.snapshot(), { epoch, generation: '0', pending: 1 });
  redis.failNext = 'after';
  await assert.rejects(a.commit(ticket), { code: 'UNAVAILABLE' });
  assert.deepEqual(await b.snapshot(), { epoch, generation: '1', pending: 0 });
  await a.commit(ticket);
  assert.deepEqual(await b.snapshot(), { epoch, generation: '1', pending: 0 });
});

test('Pending markers are bounded, nonexpiring and cannot be silently removed by another epoch', async () => {
  const { a, redis } = await initialized();
  const tickets = [];
  for (let i = 0; i < MARKETPLACE_PENDING_LIMIT; i++)
    tickets.push(await a.begin(randomUUID()));
  await assert.rejects(a.begin(randomUUID()), { code: 'UNAVAILABLE' });
  assert.equal((await a.snapshot())?.pending, MARKETPLACE_PENDING_LIMIT);
  await assert.rejects(a.commit({ ...tickets[0], epoch: randomUUID() }), {
    code: 'UNAVAILABLE',
  });
  await assert.rejects(a.abort({ ...tickets[0], epoch: randomUUID() }), {
    code: 'UNAVAILABLE',
  });
  assert.equal((await a.snapshot())?.pending, MARKETPLACE_PENDING_LIMIT);
  redis.ttl = 1000;
  await assert.rejects(a.snapshot(), { code: 'UNAVAILABLE' });
  redis.ttl = -1;
  await a.abort(tickets[0]);
  assert.equal((await a.snapshot())?.pending, MARKETPLACE_PENDING_LIMIT - 1);
});

test('Operator-only initialization and reset use epoch CAS and preserve a monotonic counter across a new epoch', async () => {
  const { a, b, redis, epoch } = await initialized();
  await assert.rejects(a.initializeAfterQuiescence(null, randomUUID()), {
    code: 'UNAVAILABLE',
  });
  const ticket = await a.begin(randomUUID());
  await a.commit(ticket);
  const abandoned = await b.begin(randomUUID());
  await assert.rejects(a.resetAfterQuiescence(randomUUID(), randomUUID()), {
    code: 'UNAVAILABLE',
  });
  await assert.rejects(a.resetAfterQuiescence(epoch, epoch), {
    code: 'UNAVAILABLE',
  });
  const rotated = randomUUID();
  assert.deepEqual(await a.resetAfterQuiescence(epoch, rotated), {
    epoch: rotated,
    generation: '2',
    pending: 0,
  });
  await assert.rejects(a.commit(abandoned), { code: 'UNAVAILABLE' });
  assert.deepEqual(await b.snapshot(), {
    epoch: rotated,
    generation: '2',
    pending: 0,
  });
  redis.hash = null;
  assert.equal(await b.snapshot(), null);
  await assert.rejects(b.begin(randomUUID()), { code: 'UNAVAILABLE' });
  const replacement = randomUUID();
  assert.deepEqual(await a.initializeAfterQuiescence(null, replacement), {
    epoch: replacement,
    generation: '0',
    pending: 0,
  });
  assert.notEqual(replacement, epoch);
  assert.notEqual(replacement, rotated);
});

test('Generation strings retain Redis integer precision and overflow keeps the marker dirty', async () => {
  const { a, redis, epoch } = await initialized();
  redis.hash!.set('generation', '9007199254740993');
  const ticket = await a.begin(randomUUID());
  await a.commit(ticket);
  assert.equal((await a.snapshot())?.generation, '9007199254740994');
  redis.hash!.set('generation', '9223372036854775807');
  const blocked = await a.begin(randomUUID());
  await assert.rejects(a.commit(blocked), { code: 'UNAVAILABLE' });
  await assert.rejects(a.resetAfterQuiescence(epoch, randomUUID()), {
    code: 'UNAVAILABLE',
  });
  assert.equal((await a.snapshot())?.pending, 1);
});

test('Malformed provider responses, state, tickets and diagnostics always sanitize to UNAVAILABLE', async () => {
  const epoch = randomUUID();
  for (const result of [
    null,
    {},
    ['missing', 'extra'],
    ['ok', epoch, '01', 0],
    ['ok', epoch, '-1', 0],
    ['ok', epoch, '9223372036854775808', 0],
    ['ok', epoch, '0', -1],
    ['ok', epoch, '0', 65],
    ['ok', 'invalid', '0', 0],
  ]) {
    const store = new UpstashMarketplaceGeneration(async () => result);
    await assert.rejects(store.snapshot(), {
      code: 'UNAVAILABLE',
      message: 'UNAVAILABLE',
    });
  }
  const failed = new UpstashMarketplaceGeneration(async () => {
    throw Error('Private provider diagnostics');
  });
  await assert.rejects(failed.snapshot(), {
    code: 'UNAVAILABLE',
    message: 'UNAVAILABLE',
  });
  const { a, redis } = await initialized();
  const before = redis.calls.length;
  await assert.rejects(a.begin('private-user-id'), { code: 'UNAVAILABLE' });
  await assert.rejects(a.commit({ epoch, token: 'invalid' }), {
    code: 'UNAVAILABLE',
  });
  assert.equal(redis.calls.length, before);
  redis.hash!.set('unrecognized', 'value');
  await assert.rejects(a.snapshot(), { code: 'UNAVAILABLE' });
});

test('Bounded Upstash command adapter refuses missing credentials without making a network request', async () => {
  let calls = 0;
  await assert.rejects(
    upstashCommand(['EVAL', 'return 1', '0'], {}, async () => {
      calls += 1;
      throw Error('Network must not execute.');
    }),
    { code: 'UNAVAILABLE', message: 'UNAVAILABLE' },
  );
  assert.equal(calls, 0);
});
