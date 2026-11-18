import { createClerkClient } from '@clerk/backend';
import { isolatedDatabase } from './d4-database';
import { spawn } from 'node:child_process';

async function main() {
  if (
    process.env.MENTORALM_ENV !== 'local' ||
    !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') ||
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_')
  )
    throw Error('Local Clerk Development required.');
  const fixture = await isolatedDatabase(process.env.D4_TEST_SCHEMA);
  try {
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const owners = await clerk.users.getUserList({
      emailAddress: ['arcaderobo3@gmail.com'],
      limit: 2,
    });
    if (owners.totalCount !== 1 || owners.data.length !== 1)
      throw Error('Existing Development owner required.');
    const owner = await fixture.db.user.create({
      data: { clerkUserId: owners.data[0].id },
    });
    await fixture.db.userRoleAssignment.create({
      data: { userId: owner.id, role: 'ADMIN' },
    });
    await fixture.db.adminAuthorization.create({
      data: { userId: owner.id, permissions: ['MARKETPLACE_MANAGE'] },
    });
    // Only a disposable Test schema receives this authority. Development roles remain untouched.
    const child = spawn(
      process.execPath,
      ['scripts/production/start.mjs', '--port', '3113'],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          MENTORALM_ENV: 'test',
          DATABASE_URL: fixture.url,
        },
      },
    );
    for (const signal of ['SIGINT', 'SIGTERM'] as const)
      process.on(signal, () => child.kill(signal));
    child.on('exit', async (code) => {
      await fixture.cleanup();
      process.exit(code || 0);
    });
  } catch {
    await fixture.cleanup();
    throw Error('Marketplace isolated test server setup failed.');
  }
}
main().catch(() => {
  console.error(
    'Marketplace Test setup failed; connection and identity details withheld.',
  );
  process.exitCode = 1;
});
