import { loadEnvConfig } from '@next/env';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
loadEnvConfig(process.cwd());
export function testDatabaseUrl(): string | null {
  if (!process.env.TEST_DATABASE_URL) return null;
  if (process.env.ALLOW_DATABASE_TESTS !== '1')
    throw new Error('Database tests require ALLOW_DATABASE_TESTS=1.');
  let url: URL;
  try {
    url = new URL(process.env.TEST_DATABASE_URL);
  } catch {
    throw new Error('Invalid test database configuration.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('D4 database tests are restricted to local PostgreSQL.');
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !/^\/[a-zA-Z0-9_-]+_test$/.test(url.pathname)
  )
    throw new Error(
      'TEST_DATABASE_URL must name a dedicated database ending in _test.',
    );
  if (process.env.DATABASE_URL) {
    const runtime = new URL(process.env.DATABASE_URL);
    if (
      ['localhost', '127.0.0.1', '[::1]'].includes(runtime.hostname) &&
      (runtime.port || '5432') === (url.port || '5432') &&
      runtime.pathname === url.pathname
    )
      throw new Error('Development and test databases must be separate.');
  }
  return url.toString();
}
export async function isolatedDatabase(requestedSchema?: string) {
  const configured = testDatabaseUrl();
  if (!configured) throw new Error('TEST_DATABASE_URL is required.');
  const schema = requestedSchema || `d4_${randomBytes(12).toString('hex')}`;
  if (!/^d4_[a-f0-9]{24}$/.test(schema))
    throw new Error('Invalid isolated schema.');
  const url = new URL(configured);
  url.searchParams.set('schema', schema);
  const admin = new Client({
    connectionString: configured,
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();
  const identity = await admin.query<{ database: string }>(
    'SELECT current_database() AS database',
  );
  if (
    identity.rows[0]?.database !== decodeURIComponent(url.pathname.slice(1))
  ) {
    await admin.end();
    throw new Error('Test database identity mismatch.');
  }
  await admin.query(`CREATE SCHEMA "${schema}"`);
  try {
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      {
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: 'pipe',
      },
    );
  } catch {
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
    throw new Error(
      'Isolated test migration failed; connection details withheld.',
    );
  }
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: configured }, { schema }),
  });
  return {
    db,
    schema,
    url: url.toString(),
    async cleanup() {
      await db.$disconnect();
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    },
  };
}
