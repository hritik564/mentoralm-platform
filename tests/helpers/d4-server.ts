import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isolatedDatabase, testDatabaseUrl } from './d4-database';
async function main() {
  const isolated = testDatabaseUrl()
    ? await isolatedDatabase(process.env.D4_TEST_SCHEMA)
    : null;
  const schema = process.env.D4_TEST_SCHEMA;
  if (!schema || !/^d4_[a-f0-9]{24}$/.test(schema))
    throw new Error('Invalid test schema.');
  const files = join(tmpdir(), `mentoralm-${schema}`);
  await mkdir(files);
  await writeFile(join(files, 'fixture.txt'), 'Authorized D4 test fixture');
  const child = spawn(
    process.execPath,
    [
      'scripts/production/start.mjs',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3100',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        MENTORALM_ENV: 'test',
        DATABASE_URL: isolated?.url || '',
        RESOURCE_FILES_ROOT: files,
        REFERRAL_APP_ORIGIN: 'https://mentoralm.example.test',
        ...(process.env.L2_TEST_MEDIA === '1'
          ? {
              LMS_FILES_ROOT: files,
              LMS_SUBMISSIONS_ROOT: files,
              LMS_EXTERNAL_LINKS: JSON.stringify({
                fixture: 'https://learning.example.test/course',
              }),
              LMS_EXTERNAL_ORIGINS: 'https://learning.example.test',
            }
          : {}),
      },
    },
  );
  let closing = false;
  async function cleanup() {
    if (closing) return;
    closing = true;
    await isolated?.cleanup();
    await rm(files, { recursive: true, force: true });
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => child.kill(signal));
  child.on('exit', async (code) => {
    await cleanup();
    process.exit(code || 0);
  });
}
main().catch(() => {
  console.error('D4 test server setup failed; configuration withheld.');
  process.exit(1);
});
