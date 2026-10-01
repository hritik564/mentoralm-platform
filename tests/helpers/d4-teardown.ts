import { Client } from 'pg';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testDatabaseUrl } from './d4-database';
export default async function teardown() {
  const schema = process.env.D4_TEST_SCHEMA;
  if (!schema || !/^d4_[a-f0-9]{24}$/.test(schema))
    throw new Error('Invalid teardown schema.');
  const configured = testDatabaseUrl();
  if (configured) {
    const db = new Client({ connectionString: configured });
    await db.connect();
    try {
      const identity = await db.query('SELECT current_database() AS database');
      if (
        identity.rows[0]?.database !==
        decodeURIComponent(new URL(configured).pathname.slice(1))
      )
        throw new Error('Test database identity mismatch.');
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await db.end();
    }
  }
  await rm(join(tmpdir(), `mentoralm-${schema}`), {
    recursive: true,
    force: true,
  });
}
