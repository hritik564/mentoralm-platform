// Offline P1 creates this future operator command; never invoke it against Production during P1.
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { databasePoolConfig } from '../../src/lib/production/database';
import {
  migrationsReady,
  type MigrationRow,
} from '../../src/lib/production/readiness';
import { operatorIntent } from './intent';
import { applicationSchemaEmpty } from './schema-preflight';
import { verifyReleaseManifest } from './manifest';
async function main() {
  const command = process.argv[2],
    intent = operatorIntent(process.env, command, process.argv.slice(3));
  verifyReleaseManifest();
  const connection = new Client(
    databasePoolConfig({ ...process.env, DATABASE_URL: intent.url.toString() }),
  );
  await connection.connect();
  try {
    const identity = (
      await connection.query(
        'SELECT current_database() AS name, current_schema() AS schema',
      )
    ).rows[0];
    if (
      identity?.name !== intent.database ||
      identity?.schema !== intent.schema
    )
      throw Error('Connected target mismatch.');
    if (
      !(
        await connection.query(
          "SELECT 1 FROM pg_namespace WHERE nspname='public'",
        )
      ).rowCount
    )
      throw Error('Expected schema absent.');
    const exists = (
      await connection.query(
        `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`,
      )
    ).rows[0].present;
    const rows: MigrationRow[] = exists
      ? (
          await connection.query(
            'SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations"',
          )
        ).rows
      : [];
    if (!migrationsReady(rows, command === 'status'))
      throw Error('Migration state invalid or incomplete.');
    if (!exists && !(await applicationSchemaEmpty(connection)))
      throw Error('Unbaselined nonempty application schema.');
    console.info(
      JSON.stringify({
        command,
        target: { database: intent.database, schema: intent.schema },
        applied: rows.filter((r) => !r.rolled_back_at).length,
        releaseMigrations: 11,
        changeTicket: intent.ticket,
      }),
    );
    if (command === 'deploy') {
      execFileSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
        {
          env: { ...process.env, DATABASE_URL: intent.url.toString() },
          stdio: 'pipe',
          timeout: 600000,
        },
      );
      const after: MigrationRow[] = (
        await connection.query(
          'SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations"',
        )
      ).rows;
      if (!migrationsReady(after))
        throw Error('Post-deploy migration validation failed.');
      console.info(
        JSON.stringify({
          command,
          result: 'ALL_MIGRATIONS_APPLIED',
          applied: after.filter((r) => !r.rolled_back_at).length,
        }),
      );
    }
  } finally {
    await connection.end();
  }
}
main().catch(() => {
  console.error(
    'Production database operation refused or failed. Sensitive diagnostics withheld. Preserve evidence and follow the recovery runbook.',
  );
  process.exitCode = 1;
});
