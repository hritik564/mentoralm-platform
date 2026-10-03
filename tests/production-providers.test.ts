import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';
import {
  approvedOrigins,
  validateEnvironment,
  type Environment,
} from '../src/lib/production/config';
import { runtimeArguments } from '../src/lib/production/runtime.mjs';
import { publicConfigurationHash } from '../src/lib/production/public-config.mjs';
import { infrastructureProbePath } from '../src/lib/production/infrastructure-probe';
import { databasePoolConfig } from '../src/lib/production/database';
import { operatorIntent } from '../scripts/production/intent';
import { applicationSchemaEmpty } from '../scripts/production/schema-preflight';
import { isolatedDatabase, testDatabaseUrl } from './helpers/d4-database';
import { governanceTransaction } from '../src/lib/admin/governance/access';
import { mutationLimiter } from '../src/lib/student/abuse';
import {
  UpstashMutationLimiter,
  upstashReady,
  mutationWindowScript,
} from '../src/lib/production/upstash';
import {
  BetterStackTransport,
  betterStackConfiguration,
} from '../src/lib/production/better-stack';
import { logRecord } from '../src/lib/production/logging';
import { withRequestContext } from '../src/lib/production/request-context';
import { readiness, providerReadiness } from '../src/lib/production/readiness';
import type { ProviderFetch } from '../src/lib/production/provider-http';
// Fake config/log fixture: assemble at runtime to avoid provider-secret signatures in source.
const syntheticSecret = [
  'sk',
  '_',
  'live',
  '_',
  'SyntheticOnlyNoConnections',
].join('');
const production = (): Environment => ({
  MENTORALM_ENV: 'production',
  NODE_ENV: 'production',
  ...approvedOrigins,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from('clerk.mentoralm.com$').toString('base64')}`,
  CLERK_SECRET_KEY: syntheticSecret,
  DATABASE_URL: [
    'postgresql://',
    'synthetic',
    ':',
    'synthetic',
    '@',
    'ep-synthetic.ap-southeast-1.aws.neon.tech/mentoralm_prod?sslmode=require&sslaccept=strict',
  ].join(''),
  MIGRATION_DATABASE_URL: [
    'postgresql://',
    'synthetic',
    ':',
    'synthetic',
    '@',
    'ep-synthetic.ap-southeast-1.aws.neon.tech/mentoralm_prod?sslmode=require&sslaccept=strict',
  ].join(''),
  PRODUCTION_DATABASE_NAME: 'mentoralm_prod',
  RATE_LIMIT_BACKEND: 'upstash',
  UPSTASH_REDIS_REST_URL: 'https://synthetic.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'synthetic-token',
  BETTER_STACK_INGEST_URL: 'https://s123.eu-nbg-2.betterstackdata.com',
  BETTER_STACK_SOURCE_TOKEN: 'synthetic-log-token',
  REPLIT_BOOTSTRAP_HOST: 'mentoralm-synthetic.replit.app',
});
const reply =
  (value: unknown, status = 200): ProviderFetch =>
  async () =>
    Response.json(value, { status });

test('selected Production config enforces direct Neon Singapore, TLS and local isolation', () => {
  const env = production();
  assert.equal(validateEnvironment(env).mode, 'production');
  assert.equal(databasePoolConfig(env).max, 8);
  assert.deepEqual(databasePoolConfig(env).ssl, { rejectUnauthorized: true });
  const args = [
    '--confirm-production=mentoralm_prod',
    '--expected-host=ep-synthetic.ap-southeast-1.aws.neon.tech',
    '--change-ticket=P1-test',
  ];
  assert.equal(
    operatorIntent(env, 'preflight', args).database,
    'mentoralm_prod',
  );
  for (const url of [
    env.DATABASE_URL!.replace('ep-synthetic.', 'ep-synthetic-pooler.'),
    env.DATABASE_URL!.replace('ap-southeast-1', 'us-east-1'),
    env.DATABASE_URL!.replace('require', 'disable'),
    env.DATABASE_URL! + '&sslmode=require',
  ]) {
    assert.throws(() => validateEnvironment({ ...env, DATABASE_URL: url }));
    assert.throws(() =>
      operatorIntent(
        { ...env, MIGRATION_DATABASE_URL: url },
        'preflight',
        args,
      ),
    );
  }
  assert.throws(() =>
    validateEnvironment({
      ...env,
      MIGRATION_DATABASE_URL: env.MIGRATION_DATABASE_URL!.replace(
        'ep-synthetic.',
        'ep-another.',
      ),
    }),
  );
  assert.throws(() =>
    validateEnvironment({
      ...env,
      NEXT_PUBLIC_SITE_URL: 'https://mentoralm-synthetic.replit.app',
    }),
  );
  assert.throws(() =>
    validateEnvironment({ ...env, RATE_LIMIT_BACKEND: 'process-local' }),
  );
  assert.throws(() => validateEnvironment({ ...env, MENTORALM_ENV: 'local' }));
  assert.throws(() =>
    validateEnvironment({
      MENTORALM_ENV: 'local',
      UPSTASH_REDIS_REST_TOKEN: 'synthetic-token',
    }),
  );
  assert.equal(
    validateEnvironment({
      ...env,
      DATABASE_URL: env.DATABASE_URL!.replace(
        '.ap-southeast-1.',
        '.c-2.ap-southeast-1.',
      ),
      MIGRATION_DATABASE_URL: undefined,
    }).mode,
    'production',
  );
});
test('Replit infrastructure host exposes only exact safe probes, never business or auth origins', () => {
  const env = production(),
    host = env.REPLIT_BOOTSTRAP_HOST!;
  assert.equal(infrastructureProbePath(host, '/', 'GET', env), '/api/health');
  assert.equal(
    infrastructureProbePath(host, '/api/readiness', 'HEAD', env),
    '/api/readiness',
  );
  for (const path of [
    '/admin',
    '/sign-in',
    '/api/admin/governance/users',
    '/learn',
    '/_next/a.js',
    '/api/health/extra',
  ])
    assert.equal(infrastructureProbePath(host, path, 'GET', env), null);
  for (const bad of [
    'another.replit.app',
    host + '.evil.test',
    host + ':8080',
    host + '@evil.test',
  ])
    assert.equal(infrastructureProbePath(bad, '/api/health', 'GET', env), null);
  assert.equal(infrastructureProbePath(host, '/api/health', 'POST', env), null);
  assert.equal(
    infrastructureProbePath(host, '/', 'GET', {
      ...env,
      MENTORALM_ENV: 'local',
    }),
    null,
  );
});
test('Replit production bind/PORT rejects downgrade and malformed inputs; local stays loopback', () => {
  assert.deepEqual(
    runtimeArguments({ MENTORALM_ENV: 'production', PORT: '8080' }),
    ['--hostname', '0.0.0.0', '--port', '8080'],
  );
  assert.deepEqual(runtimeArguments({ MENTORALM_ENV: 'local' }), [
    '--hostname',
    '127.0.0.1',
    '--port',
    '3000',
  ]);
  for (const port of ['0', '65536', 'bad', '3000;echo'])
    assert.throws(() =>
      runtimeArguments({ MENTORALM_ENV: 'production', PORT: port }),
    );
  assert.throws(() =>
    runtimeArguments({ MENTORALM_ENV: 'production' }, [
      '--hostname',
      '127.0.0.1',
    ]),
  );
  assert.throws(() =>
    runtimeArguments({ MENTORALM_ENV: 'production', PORT: '8080' }, [
      '--port',
      '3000',
    ]),
  );
  assert.throws(() =>
    runtimeArguments({ MENTORALM_ENV: 'production' }, [
      '--hostname',
      '0.0.0.0',
      '-H',
      '127.0.0.1',
    ]),
  );
});
test('guarded startup consumes deployment PORT, binds all interfaces and forwards shutdown without migrations', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'mentoralm-provider-start-'));
  const env = production();
  await mkdir(join(cwd, '.next'));
  await writeFile(
    join(cwd, '.next/required-server-files.json'),
    JSON.stringify({
      config: {
        env: {
          MENTORALM_BUILD_PUBLIC_CONFIG_HASH: publicConfigurationHash(env),
        },
      },
    }),
  );
  await mkdir(join(cwd, 'node_modules/next/dist/bin'), { recursive: true });
  await writeFile(
    join(cwd, 'node_modules/next/dist/bin/next'),
    `const http=require('node:http');const a=process.argv;const host=a[a.indexOf('--hostname')+1],port=Number(a[a.indexOf('--port')+1]);const server=http.createServer((q,s)=>s.end('synthetic'));server.listen(port,host,()=>console.log(JSON.stringify({host,port})));process.on('SIGTERM',()=>server.close(()=>{console.log('SHUTDOWN_FORWARDED');process.exit(0)}));`,
  );
  const child = spawn(
    process.execPath,
    [resolve('scripts/production/start.mjs')],
    {
      cwd,
      env: { ...env, NODE_ENV: 'production', PORT: '3127' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', (b) => (output += b));
  child.stderr.on('data', (b) => (output += b));
  try {
    for (let i = 0; i < 100 && !output.includes('"host"'); i++) {
      if (child.exitCode !== null) throw Error('Startup exited');
      await delay(50);
    }
    assert.match(output, /"host":"0.0.0.0","port":3127/);
    assert.equal(
      await (await fetch('http://127.0.0.1:3127')).text(),
      'synthetic',
    );
    const done = once(child, 'exit');
    child.kill('SIGTERM');
    const exited = await Promise.race([
      done,
      delay(15000, undefined, { ref: false }).then(() => {
        throw Error('Shutdown timed out');
      }),
    ]);
    assert.equal(exited[0], 0);
    assert.match(output, /SHUTDOWN_FORWARDED/);
    assert.ok(!output.includes('synthetic:synthetic'));
    assert.ok(!output.includes('migrate'));
  } finally {
    if (child.exitCode === null) child.kill('SIGKILL');
    await rm(cwd, { recursive: true, force: true });
  }
});
test('Upstash shared admission across instances has one stable opaque policy key and one atomic expiring command', async () => {
  let count = 0,
    now = 0,
    expires = 0;
  const bodies: unknown[][] = [];
  const fetcher: ProviderFetch = async (_url, options) => {
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.cache, 'no-store');
    const command = JSON.parse(String(options?.body)) as unknown[];
    bodies.push(command);
    assert.equal(command[0], 'EVAL');
    assert.equal(command[1], mutationWindowScript);
    assert.equal(command[2], '1');
    assert.ok(!String(command[3]).includes('private-student-id'));
    if (expires <= now) {
      count = 0;
      expires = now + 60000;
    }
    const allowed = count < Number(command[4]);
    if (allowed) count++;
    return Response.json({ result: [allowed ? 1 : 0, expires - now] });
  };
  const a = new UpstashMutationLimiter(production, fetcher),
    b = new UpstashMutationLimiter(production, fetcher);
  const results = await Promise.allSettled(
    Array.from({ length: 25 }, (_, i) =>
      (i % 2 ? a : b).check('private-student-id', 'support'),
    ),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 10);
  for (const r of results)
    if (r.status === 'rejected') assert.equal(r.reason.code, 'RATE_LIMITED');
  assert.equal(new Set(bodies.map((c) => c[3])).size, 1);
  assert.equal(count, 10);
  now = 60001;
  await a.check('private-student-id', 'support');
  assert.equal(count, 1);
  await a.check('another-student', 'academic');
  assert.notEqual(bodies.at(-1)![3], bodies[0][3]);
});
test('Upstash missing, invalid, redirect, denied, malformed, oversized and hanging authority always fails closed', async () => {
  let calls = 0;
  const spy: ProviderFetch = async () => {
    calls++;
    return Response.json({ result: [1, 60000] });
  };
  for (const env of [
    { ...production(), UPSTASH_REDIS_REST_TOKEN: undefined },
    { ...production(), UPSTASH_REDIS_REST_URL: 'http://localhost' },
    { ...production(), RATE_LIMIT_BACKEND: 'process-local' },
  ])
    await assert.rejects(
      new UpstashMutationLimiter(() => env, spy).check('student', 'academic'),
      { code: 'UNAVAILABLE' },
    );
  assert.equal(calls, 0);
  const hang: ProviderFetch = async () => new Promise(() => {});
  for (const fetcher of [
    reply({}, 503),
    reply({}, 302),
    reply({ error: 'sensitive diagnostic' }),
    reply({ result: [1, -1] }),
    reply({ result: [1, 60001] }),
    reply({ result: [2, 60000] }),
    reply({ result: 'true' }),
    reply({ data: 'x'.repeat(9000) }),
    hang,
  ])
    await assert.rejects(
      new UpstashMutationLimiter(production, fetcher, 20).check(
        'student',
        'academic',
      ),
      { code: 'UNAVAILABLE' },
    );
  const previous = process.env.MENTORALM_ENV;
  const url = process.env.UPSTASH_REDIS_REST_URL,
    token = process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    process.env.MENTORALM_ENV = 'production';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    await assert.rejects(mutationLimiter.check('fresh-actor', 'academic'), {
      code: 'UNAVAILABLE',
    });
  } finally {
    for (const [key, value] of Object.entries({
      MENTORALM_ENV: previous,
      UPSTASH_REDIS_REST_URL: url,
      UPSTASH_REDIS_REST_TOKEN: token,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test('Production readiness requires write-capable limiter plus database/migrations guard, excluding observability/P2', async () => {
  const env = production();
  assert.equal(await upstashReady(env, reply({ result: 10000 })), true);
  assert.equal(await upstashReady(env, reply({ result: 'PONG' })), false);
  assert.equal(await upstashReady(env, reply({ error: 'ACL denied' })), false);
  assert.equal(
    await readiness(
      env,
      async () => true,
      async () => true,
    ),
    true,
  );
  assert.equal(
    await readiness(
      { ...env, BETTER_STACK_INGEST_URL: 'bad' },
      async () => true,
      async () => true,
    ),
    true,
  );
  assert.equal(
    await readiness(
      {
        ...env,
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
      },
      async () => true,
      async () => true,
    ),
    false,
  );
  assert.equal(
    await readiness(
      env,
      async () => true,
      async () => false,
    ),
    false,
  );
  assert.equal(
    await readiness(
      env,
      async () => false,
      async () => true,
    ),
    false,
  );
  assert.equal(providerReadiness(env).objectStorage, 'NOT CONFIGURED');
  assert.match(
    providerReadiness(env).distributedRateLimiting,
    /AVAILABILITY NOT PROBED/,
  );
});
test('Better Stack forwards only projected safe fields, preserving correlation and runtime context', async () => {
  let sent = '';
  const secret = 'private-body-token-do-not-log';
  const id = randomUUID();
  const fetcher: ProviderFetch = async (_url, options) => {
    assert.equal(options?.redirect, 'error');
    sent = String(options?.body);
    return new Response('Accepted', { status: 202 });
  };
  const transport = new BetterStackTransport(production, fetcher);
  assert.ok(betterStackConfiguration(production()));
  for (const badUrl of [
    'http://s123.eu-nbg-2.betterstackdata.com',
    'https://s123.eu-nbg-2.betterstackdata.com.evil.test',
    'https://evil.test',
    'https://s123.eu-nbg-2.betterstackdata.com?token=private',
    'https://s123.eu-nbg-2.betterstackdata.com/other',
  ])
    assert.equal(
      betterStackConfiguration({
        ...production(),
        BETTER_STACK_INGEST_URL: badUrl,
      }),
      null,
    );
  transport.emit({
    ...logRecord('warn', 'request', {
      requestId: id,
      route: '/api/lms/private-id?token=' + secret,
      status: 503,
      durationMs: 18,
    }),
    ...{
      authorization: secret,
      cookie: secret,
      DATABASE_URL: secret,
      body: secret,
      error: Error(secret),
      support: secret,
    },
  });
  await transport.settled();
  assert.ok(!sent.includes(secret));
  assert.ok(!sent.includes('private-id'));
  const record = JSON.parse(sent);
  assert.equal(record.requestId, id);
  assert.equal(record.route, '/api/lms/*');
  assert.equal(record.environment, 'production');
  assert.equal(record.runtime, 'node');
  assert.equal(record.status, 503);
  assert.equal(
    betterStackConfiguration({
      ...production(),
      BETTER_STACK_INGEST_URL: 'https://evil.test',
    }),
    null,
  );
});
test('Better Stack outages, bad config, hanging sends and concurrency cannot block requests; local never sends', async () => {
  const record = logRecord('info', 'request', { requestId: randomUUID() });
  let calls = 0;
  const hang: ProviderFetch = async () => {
    calls++;
    return new Promise(() => {});
  };
  const transport = new BetterStackTransport(production, hang, 20);
  for (let i = 0; i < 1000; i++) transport.emit(record);
  assert.equal(calls, 4);
  await transport.settled();
  transport.emit(record);
  assert.equal(calls, 4);
  for (const fetcher of [
    reply(null, 403),
    async () => {
      throw Error('private token');
    },
  ]) {
    const t = new BetterStackTransport(production, fetcher);
    assert.doesNotThrow(() => t.emit(record));
    await t.settled();
  }
  const local = new BetterStackTransport(
    () => ({ ...production(), MENTORALM_ENV: 'local' }),
    hang,
  );
  local.emit(record);
  await local.settled();
  assert.equal(calls, 4);
  const invalid = new BetterStackTransport(
    () => ({ ...production(), BETTER_STACK_INGEST_URL: 'invalid' }),
    hang,
  );
  invalid.emit(record);
  await invalid.settled();
  assert.equal(calls, 4);
});
test('real request logging keeps a successful business response during Better Stack failure', async () => {
  const keys = [
    'MENTORALM_ENV',
    'BETTER_STACK_INGEST_URL',
    'BETTER_STACK_SOURCE_TOKEN',
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const records: string[] = [];
  let sends = 0;
  try {
    const env = production();
    for (const key of keys) process.env[key] = env[key];
    globalThis.fetch = async () => {
      sends++;
      throw Error('private-provider-diagnostic');
    };
    console.info = (line: string) => {
      records.push(line);
    };
    const response = await withRequestContext(
      new Request('https://mentoralm.com/api/student/profile?token=private', {
        headers: { host: 'mentoralm.com', cookie: 'private-cookie' },
      }),
      async () => Response.json({ ok: true }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(sends, 1);
    assert.equal(records.length, 1);
    assert.equal(
      JSON.parse(records[0]).requestId,
      response.headers.get('x-request-id'),
    );
    assert.ok(!records[0].includes('private'));
    await delay(0);
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
test('unbaselined application preflight detects standalone functions/types and ignores unrelated namespaces', async () => {
  const f = await isolatedDatabase();
  const schema = `d4_${randomBytes(12).toString('hex')}`;
  const client = new Client({ connectionString: testDatabaseUrl()! });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    assert.equal(await applicationSchemaEmpty(client, schema), true);
    assert.equal(await applicationSchemaEmpty(client, f.schema), false);
    await client.query(
      `CREATE FUNCTION "${schema}".unexpected() RETURNS int LANGUAGE sql AS 'SELECT 1'`,
    );
    assert.equal(await applicationSchemaEmpty(client, schema), false);
    await client.query(`DROP FUNCTION "${schema}".unexpected()`);
    await client.query(`CREATE TYPE "${schema}".unexpected AS ENUM ('bad')`);
    assert.equal(await applicationSchemaEmpty(client, schema), false);
  } finally {
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
    await f.cleanup();
  }
});
test('direct pg/Prisma transactions keep backend identity and shared governance lock through commit/rollback', async () => {
  const f = await isolatedDatabase();
  let ownerResolve: () => void = () => {};
  const owner = new Promise<void>((r) => (ownerResolve = r));
  let release: () => void = () => {};
  const hold = new Promise<void>((r) => (release = r));
  let entered = false;
  try {
    const first = governanceTransaction(f.db, async (tx) => {
      const before = await tx.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;
      ownerResolve();
      await hold;
      const after = await tx.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;
      assert.equal(before[0].pid, after[0].pid);
    });
    await owner;
    const second = governanceTransaction(f.db, async () => {
      entered = true;
    });
    await delay(80);
    assert.equal(entered, false);
    release();
    await Promise.all([first, second]);
    assert.equal(entered, true);
    await assert.rejects(
      governanceTransaction(f.db, async () => {
        throw Error('rollback fixture');
      }),
    );
    await governanceTransaction(f.db, async () => {});
    const client = new Client({ connectionString: testDatabaseUrl()! });
    await client.connect();
    try {
      await client.query('SELECT pg_advisory_lock(19748962, 77)');
      await client.query('BEGIN');
      await client.query('COMMIT');
      const held = await client.query(
        'SELECT pg_advisory_unlock(19748962,77) AS released',
      );
      assert.equal(held.rows[0].released, true);
      await client.query({
        name: 'provider-prepared',
        text: 'SELECT $1::int AS value',
        values: [1],
      });
      assert.equal(
        (
          await client.query({
            name: 'provider-prepared',
            text: 'SELECT $1::int AS value',
            values: [2],
          })
        ).rows[0].value,
        2,
      );
    } finally {
      await client.end();
    }
  } finally {
    release();
    await f.cleanup();
  }
});
