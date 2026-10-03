import { createClerkClient } from '@clerk/backend';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { localSeedUrl, verifyDatabase } from '../../scripts/lms-owner/safety';
import { isolatedDatabase } from './d4-database';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
async function main() {
  const f = await isolatedDatabase(process.env.D4_TEST_SCHEMA);
  const dev = new PrismaClient({
    adapter: new PrismaPg({ connectionString: localSeedUrl(process.env) }),
  });
  try {
    await verifyDatabase(dev);
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const users = (
      await clerk.users.getUserList({
        emailAddress: ['arcaderobo3@gmail.com'],
        limit: 2,
      })
    ).data;
    if (users.length !== 1) throw Error('Existing owner required');
    const owner = await dev.user.findUniqueOrThrow({
      where: { clerkUserId: users[0].id },
    });
    const mirror = await f.db.user.create({
      data: { clerkUserId: owner.clerkUserId, role: 'STUDENT' },
    });
    await f.db.userRoleAssignment.create({
      data: { userId: mirror.id, role: 'ADMIN' },
    });
    await f.db.adminAuthorization.create({
      data: { userId: mirror.id, authority: 'GOVERNANCE' },
    });
  } catch (error) {
    await f.cleanup();
    throw error;
  } finally {
    await dev.$disconnect();
  }
  const root = join(tmpdir(), `mentoralm-${f.schema}`);
  await mkdir(root, { recursive: true });
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
        DATABASE_URL: f.url,
        RESOURCE_FILES_ROOT: root,
        LMS_FILES_ROOT: root,
        LMS_SUBMISSIONS_ROOT: root,
      },
    },
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => child.kill(signal));
  child.on('exit', async (code) => {
    await f.db.$disconnect();
    await rm(root, { recursive: true, force: true });
    process.exit(code || 0);
  });
}
main().catch(() => {
  console.error(
    'Isolated Admin regression setup failed; configuration withheld.',
  );
  process.exitCode = 1;
});
