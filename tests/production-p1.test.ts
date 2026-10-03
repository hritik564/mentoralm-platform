import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  validateEnvironment,
  ConfigurationError,
  approvedOrigins,
  type Environment,
} from '../src/lib/production/config';
import { databasePoolConfig } from '../src/lib/production/database';
import {
  readiness,
  migrationsReady,
  providerReadiness,
} from '../src/lib/production/readiness';
import { migrationManifest } from '../src/lib/production/migrations';
import { logRecord } from '../src/lib/production/logging';
import { securityHeaders } from '../src/lib/production/security';
import { sameOrigin } from '../src/lib/production/origin';
import {
  withRequestContext,
  requestContext,
} from '../src/lib/production/request-context';
import { operatorIntent } from '../scripts/production/intent';
import { verifyReleaseManifest } from '../scripts/production/manifest';
import { localSeedUrl } from '../scripts/lms-owner/safety';
import { isolatedDatabase, testDatabaseUrl } from './helpers/d4-database';
import {
  LocalMutationLimiter,
  mutationLimiter,
} from '../src/lib/student/abuse';
import {
  approvedRequestHost,
  domainRoute,
  adminDestination,
  authorizedSessionParties,
} from '../src/lib/platform/domains';
// Fake config/log fixture: assemble at runtime to avoid provider-secret signatures in source.
const syntheticSecret = [
  'sk',
  '_',
  'live',
  '_',
  'SyntheticOnlyNoProviderCalls',
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
    'ep-synthetic.ap-southeast-1.aws.neon.tech/mentoralm_prod?schema=public&sslmode=require&sslaccept=strict',
  ].join(''),
  MIGRATION_DATABASE_URL: [
    'postgresql://',
    'synthetic',
    ':',
    'synthetic',
    '@',
    'ep-synthetic.ap-southeast-1.aws.neon.tech/mentoralm_prod?schema=public&sslmode=require&sslaccept=strict',
  ].join(''),
  PRODUCTION_DATABASE_NAME: 'mentoralm_prod',
});
test('P1 validated environment fails safely on missing/downgraded Production configuration', () => {
  assert.equal(validateEnvironment(production()).mode, 'production');
  for (const key of [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_LMS_ORIGIN',
    'NEXT_PUBLIC_ADMIN_ORIGIN',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'DATABASE_URL',
    'PRODUCTION_DATABASE_NAME',
  ]) {
    const env = production();
    delete env[key];
    assert.throws(() => validateEnvironment(env), ConfigurationError);
  }
  for (const [key, value] of Object.entries({
    MENTORALM_ENV: 'unknown',
    CLERK_SECRET_KEY: 'sk_test_Synthetic',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Synthetic',
    DATABASE_URL: [
      'postgres://',
      'synthetic',
      ':',
      'synthetic',
      '@',
      'localhost/mentoralm_dev',
    ].join(''),
    TEST_DATABASE_URL: 'postgres://localhost/mentoralm_test',
    ALLOW_DATABASE_TESTS: '1',
    LMS_FILES_ROOT: '/private/sensitive',
    LMS_SUBMISSIONS_ROOT: '/private/sensitive',
    RESOURCE_FILES_ROOT: '/private/sensitive',
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
    CLERK_DEBUG: 'true',
    NODE_ENV: 'development',
    PGHOST: 'unexpected',
    DATABASE_POOL_MAX: '1000',
    DATABASE_CONNECT_TIMEOUT_MS: '0',
    RATE_LIMIT_BACKEND: 'redis',
  })) {
    const env = { ...production(), [key]: value };
    assert.throws(() => validateEnvironment(env), ConfigurationError);
  }
  assert.throws(() => validateEnvironment({ NODE_ENV: 'production' }));
  assert.throws(() =>
    validateEnvironment({
      ...production(),
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from('clerk.attacker.test$').toString('base64')}`,
    }),
  );
});
test('P1 environment errors and invalid URL diagnostics never reflect secrets/paths', () => {
  const secret = 'private-secret-DO-NOT-LOG';
  try {
    validateEnvironment({
      ...production(),
      DATABASE_URL: secret,
      CLERK_SECRET_KEY: secret,
    });
    assert.fail();
  } catch (e) {
    assert.ok(e instanceof ConfigurationError);
    assert.ok(!String(e).includes(secret));
  }
  assert.throws(() =>
    validateEnvironment({
      MENTORALM_ENV: 'local',
      DATABASE_URL: 'postgres://localhost/mentoralm_prod',
    }),
  );
  assert.throws(() =>
    validateEnvironment({
      MENTORALM_ENV: 'test',
      DATABASE_URL: 'postgres://localhost/mentoralm_dev',
    }),
  );
  assert.throws(() =>
    validateEnvironment({
      MENTORALM_ENV: 'local',
      DATABASE_URL: 'postgres://localhost/mentoralm_dev?host=external.example',
    }),
  );
});
test('P1 Production URL is one explicit authenticated, verified TLS database with no query overrides', () => {
  for (const suffix of [
    '&host=attacker.test',
    '&ssl=false',
    '&sslrootcert=/private/path',
    '&options=-c%20search_path%3Devil',
    '&schema=evil',
    '&sslmode=disable',
  ])
    assert.throws(() =>
      databasePoolConfig({
        ...production(),
        DATABASE_URL: production().DATABASE_URL! + suffix,
      }),
    );
  for (const host of ['127.0.0.2', '0.0.0.0', '[::1]', '[::ffff:7f00:1]'])
    assert.throws(() =>
      databasePoolConfig({
        ...production(),
        DATABASE_URL: production().DATABASE_URL!.replace(
          'ep-synthetic.ap-southeast-1.aws.neon.tech',
          host,
        ),
      }),
    );
  const pool = databasePoolConfig(production());
  assert.equal(pool.max, 8);
  assert.equal(pool.connectionTimeoutMillis, 5000);
  assert.equal(pool.idleTimeoutMillis, 10000);
  assert.deepEqual(pool.ssl, { rejectUnauthorized: true });
  assert.ok(!pool.connectionString?.includes('sslmode'));
  assert.equal(pool.query_timeout, 10000);
});
test('P1 operator tools default refuse and require exact intent/target/ticket/recent backup', () => {
  const args = [
    '--confirm-production=mentoralm_prod',
    '--expected-host=ep-synthetic.ap-southeast-1.aws.neon.tech',
    '--change-ticket=CHANGE-123',
  ];
  assert.throws(() => operatorIntent(production(), 'deploy', args));
  assert.equal(
    operatorIntent(production(), 'preflight', args).schema,
    'public',
  );
  assert.equal(
    operatorIntent(production(), 'deploy', [
      ...args,
      '--backup-reference=backup-123',
      `--backup-timestamp=${new Date(Date.now() - 1000).toISOString()}`,
    ]).database,
    'mentoralm_prod',
  );
  for (const bad of [
    '--confirm-production=wrong',
    '--change-ticket=body with spaces',
    '--reset=yes',
  ])
    assert.throws(() =>
      operatorIntent(production(), 'preflight', [...args, bad]),
    );
  assert.throws(() =>
    operatorIntent({ ...production(), MENTORALM_ENV: 'local' }, 'status', args),
  );
  assert.throws(() => operatorIntent(production(), 'reset', args));
  assert.throws(() =>
    operatorIntent(
      {
        ...production(),
        MIGRATION_DATABASE_URL: production().MIGRATION_DATABASE_URL!.replace(
          'mentoralm_prod',
          'mentoralm_test',
        ),
      },
      'preflight',
      args,
    ),
  );
  for (const f of [
    'scripts/production/database.ts',
    'scripts/production/offline-preflight.ts',
  ])
    assert.ok(!readFileSync(f, 'utf8').includes('loadEnvConfig'));
});
test('P1 local/test guardrails cannot target Production; cleanup remains disposable only', () => {
  assert.throws(() =>
    localSeedUrl({
      ...production(),
      DATABASE_URL: 'postgres://localhost/mentoralm_dev',
    }),
  );
  const before = process.env.TEST_DATABASE_URL;
  try {
    process.env.TEST_DATABASE_URL = 'postgres://remote.example/mentoralm_test';
    assert.throws(testDatabaseUrl);
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
    assert.throws(testDatabaseUrl);
  } finally {
    if (before === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = before;
  }
});
test('P1 structured logging drops body/headers/errors/queries/tokens and bounds known fields', async () => {
  const secret = 'secret-token-that-must-not-appear';
  const record = logRecord('error', 'request_error', {
    requestId: randomUUID(),
    route: `/api/student/private-id?token=${secret}`,
    domain: 'attacker.test',
    code: secret,
    durationMs: 4.7,
    ...{
      body: secret,
      authorization: secret,
      error: Error(secret),
      password: secret,
    },
  });
  assert.equal(record.route, '/api/student/*');
  assert.equal(record.durationMs, 5);
  assert.ok(!JSON.stringify(record).includes(secret));
  assert.ok(!JSON.stringify(record).includes('private-id'));
  const requestId = randomUUID();
  const response = await withRequestContext(
    new Request('http://127.0.0.1:3000/api/student/private?token=ignored', {
      headers: { 'x-mentoralm-request-id': requestId },
    }),
    async () => {
      assert.equal(requestContext.getStore()?.requestId, requestId);
      throw Error(secret);
    },
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-request-id'), requestId);
  assert.ok(!(await response.text()).includes(secret));
});
test('P1 migration release readiness rejects checksum drift, incomplete, duplicate and unknown rows', () => {
  assert.equal(verifyReleaseManifest(), 11);
  const rows = migrationManifest.map((m) => ({
    migration_name: m.name,
    checksum: m.checksum,
    finished_at: new Date(),
    rolled_back_at: null,
  }));
  assert.ok(migrationsReady(rows));
  assert.ok(migrationsReady(rows.slice(0, 3), false));
  assert.ok(!migrationsReady(rows.slice(0, 10)));
  assert.ok(!migrationsReady([...rows, rows[0]]));
  assert.ok(
    !migrationsReady([{ ...rows[0], checksum: 'tampered' }, ...rows.slice(1)]),
  );
  assert.ok(
    !migrationsReady([{ ...rows[0], finished_at: null }, ...rows.slice(1)]),
  );
  assert.ok(
    !migrationsReady([...rows, { ...rows[0], migration_name: 'unknown' }]),
  );
});
test('P1 readiness is minimal, false on failure and honest about unresolved Production providers', async () => {
  assert.equal(await readiness(production(), async () => true), false);
  assert.equal(await readiness({}, async () => true), false);
  assert.equal(
    await readiness(
      {
        MENTORALM_ENV: 'test',
        DATABASE_URL: 'postgres://localhost/mentoralm_test',
        CLERK_SECRET_KEY: 'sk_test_fixture',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture',
      },
      async () => true,
    ),
    true,
  );
  assert.equal(
    await readiness(production(), async () => {
      throw Error('password');
    }),
    false,
  );
  assert.ok(
    Object.values(providerReadiness()).every(
      (v) => v === 'NOT CONFIGURED' || v === 'NOT PRODUCTION READY',
    ),
  );
});
test('P1 rate-limit boundary retains bounded local windows and refuses unsupported Production writes', async () => {
  const limiter = new LocalMutationLimiter();
  for (let i = 0; i < 10; i++) limiter.check('fixture', 'support', 0);
  assert.throws(() => limiter.check('fixture', 'support', 0));
  limiter.check('fixture', 'support', 60001);
  const previous = process.env.MENTORALM_ENV;
  try {
    process.env.MENTORALM_ENV = 'production';
    await assert.rejects(mutationLimiter.check('fixture', 'academic'), {
      code: 'UNAVAILABLE',
    });
  } finally {
    process.env.MENTORALM_ENV = previous;
  }
});
test('P1 HTTPS/host/origin and safe return controls ignore forwarded authorities', () => {
  const local = securityHeaders({ MENTORALM_ENV: 'local' });
  assert.equal(local['X-Frame-Options'], 'SAMEORIGIN');
  assert.ok(!local['Strict-Transport-Security']);
  assert.equal(
    securityHeaders({ ...production(), PRODUCTION_HTTPS_CONFIRMED: '1' })[
      'Strict-Transport-Security'
    ],
    'max-age=86400',
  );
  assert.ok(!securityHeaders(production())['Strict-Transport-Security']);
  const old = Object.fromEntries(
    Object.keys(approvedOrigins).map((k) => [k, process.env[k]]),
  );
  try {
    Object.assign(process.env, approvedOrigins);
    for (const host of [
      'evil.mentoralm.com',
      'mentoralm.com.attacker.test',
      'attacker@mentoralm.com',
      'mentoralm.com:8080',
      'mentoralm.com/evil',
    ])
      assert.equal(approvedRequestHost(host), false);
    assert.deepEqual(
      authorizedSessionParties(),
      Object.values(approvedOrigins),
    );
    assert.deepEqual(domainRoute('admin.mentoralm.com', '/sign-in'), {
      kind: 'rewrite',
      path: '/admin-auth/sign-in',
    });
    assert.deepEqual(domainRoute('students.mentoralm.com', '/'), {
      kind: 'rewrite',
      path: '/learn',
    });
    assert.equal(adminDestination('https://evil.example/'), '/admin');
    assert.ok(
      sameOrigin(
        new Request('http://internal.test/api/student', {
          headers: {
            host: 'mentoralm.com',
            origin: 'https://mentoralm.com',
            'x-forwarded-host': 'evil.test',
          },
        }),
      ),
    );
    assert.ok(
      !sameOrigin(
        new Request('http://internal.test/api/student', {
          headers: { host: 'mentoralm.com', origin: 'http://mentoralm.com' },
        }),
      ),
    );
  } finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
test('P1 clean eleven-migration installation, audit guards and schema drift on isolated Test only', async () => {
  const f = await isolatedDatabase();
  try {
    const rows = await f.db.$queryRawUnsafe<
      {
        migration_name: string;
        checksum: string;
        finished_at: Date;
        rolled_back_at: Date | null;
      }[]
    >(
      `SELECT migration_name,checksum,finished_at,rolled_back_at FROM "${f.schema}"."_prisma_migrations"`,
    );
    assert.ok(migrationsReady(rows));
    const output = execFileSync(
      process.execPath,
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
    ).toString();
    assert.match(output, /No difference/);
    const u = await f.db.user.create({ data: { clerkUserId: 'p1-clean' } });
    await f.db.academicAudit.create({
      data: {
        actorId: u.id,
        action: 'P1_FIXTURE',
        targetId: u.id,
        details: {},
      },
    });
    await assert.rejects(
      f.db.$executeRawUnsafe(`DELETE FROM "${f.schema}"."AcademicAudit"`),
    );
    await assert.rejects(
      f.db.$executeRawUnsafe(`TRUNCATE "${f.schema}"."AcademicAudit"`),
    );
  } finally {
    await f.cleanup();
  }
});
test('P1 full historical upgrade retains earliest Student/Profile/Enrollment and generates only missing Student ID', async () => {
  const f = await isolatedDatabase(undefined, migrationManifest[0].name);
  try {
    await f.db.$executeRawUnsafe(
      `INSERT INTO "${f.schema}"."User" (id,"clerkUserId",role,"updatedAt") VALUES ('p1-student','p1-history','STUDENT',NOW()),('p1-admin','p1-history-admin','ADMIN',NOW())`,
    );
    await f.db.$executeRawUnsafe(
      `INSERT INTO "${f.schema}"."StudentProfile" ("userId",institution,"updatedAt") VALUES ('p1-student','Existing institution',NOW())`,
    );
    await f.db.$executeRawUnsafe(
      `INSERT INTO "${f.schema}"."Course" (id,title,description,"thumbnailPath","thumbnailAlt","publicPath","updatedAt") VALUES ('p1-course','Existing Course','Existing description','/image','image','/course',NOW())`,
    );
    await f.db.$executeRawUnsafe(
      `INSERT INTO "${f.schema}"."Enrollment" (id,"userId","courseId",status,"updatedAt") VALUES ('p1-enrollment','p1-student','p1-course','IN_PROGRESS',NOW())`,
    );
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
    );
    const user = await f.db.user.findUniqueOrThrow({
      where: { id: 'p1-student' },
    });
    assert.equal(user.clerkUserId, 'p1-history');
    assert.match(user.studentId!, /^MLM-STU-/);
    assert.equal(user.role, 'STUDENT');
    assert.equal(
      (
        await f.db.studentProfile.findUniqueOrThrow({
          where: { userId: user.id },
        })
      ).institution,
      'Existing institution',
    );
    assert.equal(
      (
        await f.db.enrollment.findUniqueOrThrow({
          where: { id: 'p1-enrollment' },
        })
      ).status,
      'IN_PROGRESS',
    );
    const policy = await f.db.adminAuthorization.findUniqueOrThrow({
      where: { userId: 'p1-admin' },
    });
    assert.equal(policy.authority, 'SCOPED');
    assert.equal(policy.permissions.length, 9);
    assert.equal(await f.db.academicAudit.count(), 0);
  } finally {
    await f.cleanup();
  }
});
