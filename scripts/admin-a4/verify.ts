import { loadEnvConfig } from '@next/env';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { localSeedUrl } from '../lms-owner/safety';
loadEnvConfig(process.cwd(), true);
async function main() {
  const connectionString = localSeedUrl(process.env),
    db = new Client({ connectionString });
  await db.connect();
  try {
    const identity = (
      await db.query(
        'SELECT current_database() AS name, current_schema() AS schema',
      )
    ).rows[0];
    if (identity.name !== 'mentoralm_dev' || identity.schema !== 'public')
      throw Error('Database identity mismatch');
    const migrations = (
      await db.query(
        'SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY started_at',
      )
    ).rows;
    const fixtureCounts = (
      await db.query(
        `SELECT (SELECT count(*) FROM "User" WHERE "clerkUserId" IN (SELECT "clerkUserId" FROM "User" WHERE "role"='ADMIN'))::int AS primary_admins, (SELECT count(*) FROM "UserRoleAssignment" WHERE "role"='ADMIN')::int AS additional_admin_assignments, (SELECT count(*) FROM "Batch" WHERE "code" LIKE 'A1-%')::int AS a1_fixture_batches, (SELECT count(*) FROM "Course" WHERE "title" LIKE 'A1 Course %')::int AS a1_fixture_courses`,
      )
    ).rows[0];
    console.log(
      JSON.stringify({ identity, migrations, fixtureCounts }, null, 2),
    );
    execFileSync(
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
      {
        env: { ...process.env, DATABASE_URL: connectionString },
        stdio: 'inherit',
      },
    );
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error(
    'Guarded local verification failed; connection details withheld.',
  );
  process.exitCode = 1;
});
