import { loadEnvConfig } from '@next/env';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { localSeedUrl } from '../lms-owner/safety';
loadEnvConfig(process.cwd(), true);
async function main() {
  const connectionString = localSeedUrl(process.env);
  const connection = new Client({ connectionString });
  await connection.connect();
  try {
    const { rows } = await connection.query(
      'SELECT current_database() AS name, current_schema() AS schema',
    );
    if (rows[0]?.name !== 'mentoralm_dev' || rows[0]?.schema !== 'public')
      throw Error('Unexpected development database.');
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      {
        env: { ...process.env, DATABASE_URL: connectionString },
        stdio: 'inherit',
      },
    );
  } finally {
    await connection.end();
  }
}
main().catch(() => {
  console.error('Guarded local migration failed; connection details withheld.');
  process.exitCode = 1;
});
