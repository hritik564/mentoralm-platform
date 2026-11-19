import { requireMarketplacePageBaseline } from './safety';
import { loadEnvConfig } from '@next/env';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { localSeedUrl } from '../lms-owner/safety';
import { verifyReleaseManifest } from '../production/manifest';
import {
  migrationsReady,
  type MigrationRow,
} from '../../src/lib/production/readiness';
loadEnvConfig(process.cwd(), true);
async function main() {
  // Validates local mode, Development identity keys, local origins and exact
  // loopback mentoralm_dev/public target before opening a connection.
  const connectionString = localSeedUrl(process.env);
  verifyReleaseManifest();
  const connection = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  await connection.connect();
  try {
    const { rows: identity } = await connection.query(
      'SELECT current_database() AS name, current_schema() AS schema',
    );
    if (
      identity[0]?.name !== 'mentoralm_dev' ||
      identity[0]?.schema !== 'public'
    )
      throw Error('Unexpected local migration target.');
    const before = (
      await connection.query<MigrationRow>(
        'SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations"',
      )
    ).rows;
    requireMarketplacePageBaseline(before);
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      {
        env: { ...process.env, DATABASE_URL: connectionString },
        stdio: 'pipe',
        timeout: 120000,
      },
    );
    const after = (
      await connection.query<MigrationRow>(
        'SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations"',
      )
    ).rows;
    if (!migrationsReady(after))
      throw Error('Local post-migration release verification failed.');
    console.info(
      JSON.stringify({
        target: 'local mentoralm_dev/public',
        applied: after
          .filter(
            (row) =>
              !before.some(
                (prior) => prior.migration_name === row.migration_name,
              ),
          )
          .map((row) => row.migration_name),
        total: after.length,
      }),
    );
  } finally {
    await connection.end();
  }
}
main().catch(() => {
  console.error(
    'Guarded Marketplace page-content local migration refused or failed; connection details withheld.',
  );
  process.exitCode = 1;
});
