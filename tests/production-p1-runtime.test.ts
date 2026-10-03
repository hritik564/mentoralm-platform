import test from 'node:test';
import { request as httpRequest } from 'node:http';
import { mkdtemp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { isolatedDatabase } from './helpers/d4-database';
import { approvedOrigins } from '../src/lib/production/config';
// Fake config/log fixture: assemble at runtime to avoid provider-secret signatures in source.
const syntheticSecret = [
  'sk',
  '_',
  'live',
  '_',
  'SyntheticOnlyNeverConnect',
].join('');
function server(
  env: Partial<NodeJS.ProcessEnv>,
  port: number,
  cwd = process.cwd(),
) {
  const child = spawn(
    process.execPath,
    [
      resolve('scripts/production/start.mjs'),
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  child.stdout.on('data', (c) => {
    output += String(c);
  });
  child.stderr.on('data', (c) => {
    output += String(c);
  });
  return { child, output: () => output };
}
async function stop(child: ReturnType<typeof server>['child']) {
  if (child.exitCode !== null) return;
  const done = once(child, 'exit');
  child.kill('SIGTERM');
  await done;
}
async function wait(url: string, child: ReturnType<typeof server>['child']) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null)
      throw Error('Local server exited before health.');
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // Retry only the bounded local startup probe.
    }
    await delay(100);
  }
  throw Error('Local server readiness timed out.');
}
test('P1 built runtime: safe liveness/readiness, trusted hosts, correlation, headers and anonymous denial', async () => {
  const f = await isolatedDatabase(),
    s = server({ MENTORALM_ENV: 'test', DATABASE_URL: f.url }, 3118);
  try {
    await wait('http://127.0.0.1:3118/api/health', s.child);
    const headers = {
      'x-request-id': 'untrusted',
      'x-mentoralm-request-id': 'untrusted',
      'x-forwarded-host': 'attacker.test',
      'x-forwarded-proto': 'http',
    };
    const live = await fetch('http://127.0.0.1:3118/api/health', { headers });
    assert.deepEqual(await live.json(), { status: 'ok' });
    assert.match(live.headers.get('x-request-id')!, /^[a-f0-9-]{36}$/);
    assert.equal(live.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(
      live.headers.get('referrer-policy'),
      'strict-origin-when-cross-origin',
    );
    assert.equal(live.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(live.headers.get('strict-transport-security'), null);
    const ready = await fetch('http://127.0.0.1:3118/api/readiness');
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: 'ready' });
    const bad = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        'http://127.0.0.1:3118/api/health',
        { headers: { host: 'attacker.test' } },
        (res) => {
          res.resume();
          resolve(res.statusCode!);
        },
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(bad, 400);
    const assetHost = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        'http://127.0.0.1:3118/favicon.png',
        { headers: { host: 'attacker.test' } },
        (res) => {
          res.resume();
          resolve(res.statusCode!);
        },
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(assetHost, 400);
    for (const path of [
      '/api/admin/governance/users',
      '/api/student/profile',
      '/api/lms/courses',
    ]) {
      const r = await fetch('http://127.0.0.1:3118' + path);
      assert.equal(r.status, 401);
      assert.match(r.headers.get('x-request-id')!, /^[a-f0-9-]{36}$/);
    }
    const redirect = await fetch('http://127.0.0.1:3118/admin', {
      headers: {
        'x-forwarded-host': 'attacker.test',
        'x-forwarded-proto': 'https',
      },
      redirect: 'manual',
    });
    assert.match(
      redirect.headers.get('location')!,
      /^http:\/\/127\.0\.0\.1:3118\/admin-auth\/sign-in/,
    );
    await f.db.$executeRawUnsafe(
      `ALTER TABLE "${f.schema}"."AcademicAudit" DISABLE TRIGGER academic_audit_no_truncate`,
    );
    await delay(5100);
    const unavailable = await fetch('http://127.0.0.1:3118/api/readiness');
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { status: 'unavailable' });
    const output = s.output();
    for (const key of [
      'DATABASE_URL',
      'CLERK_SECRET_KEY',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    ])
      if (process.env[key]) assert.ok(!output.includes(process.env[key]!));
    assert.ok(!output.includes('attacker.test'));
    assert.ok(output.includes('"requestId"'));
    const correlated = output
      .split('\n')
      .filter((line) => line.includes(live.headers.get('x-request-id')!));
    assert.ok(
      correlated.length >= 2,
      'Proxy and handler must share one server-generated ID',
    );
  } finally {
    await stop(s.child);
    await f.cleanup();
  }
});
test('P1 startup fails before serving with invalid Production keys/database or mismatched build', async () => {
  const isolated = await mkdtemp(join(tmpdir(), 'mentoralm-p1-startup-'));
  await symlink(resolve('.next'), join(isolated, '.next'), 'dir');
  try {
    for (const validShape of [false, true]) {
      const s = server(
        {
          MENTORALM_ENV: 'production',
          NODE_ENV: 'production',
          ...approvedOrigins,
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from('clerk.mentoralm.com$').toString('base64')}`,
          CLERK_SECRET_KEY: validShape ? syntheticSecret : 'sk_test_Forbidden',
          DATABASE_URL: validShape
            ? [
                'postgres://',
                'synthetic',
                ':',
                'synthetic',
                '@',
                'ep-synthetic.ap-southeast-1.aws.neon.tech/mentoralm_prod?sslmode=require&sslaccept=strict',
              ].join('')
            : 'postgres://localhost/mentoralm_dev',
          PRODUCTION_DATABASE_NAME: 'mentoralm_prod',
          TEST_DATABASE_URL: '',
          ALLOW_DATABASE_TESTS: '0',
          LMS_FILES_ROOT: '',
          LMS_SUBMISSIONS_ROOT: '',
          RESOURCE_FILES_ROOT: '',
        },
        3119,
        isolated,
      );
      try {
        const exited = await Promise.race([
          once(s.child, 'exit'),
          delay(15000, undefined, { ref: false }).then(() => {
            throw Error('Invalid startup did not exit.');
          }),
        ]);
        assert.notEqual(exited[0], 0);
        assert.ok(!s.output().includes('synthetic:synthetic'));
        assert.ok(!s.output().includes(syntheticSecret));
        await assert.rejects(fetch('http://127.0.0.1:3119/api/health'));
      } finally {
        await stop(s.child);
      }
    }
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});
