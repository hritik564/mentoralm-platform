import { loadEnvConfig } from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { localSeedUrl, verifyDatabase } from '../lms-owner/safety';
import { resolveExistingClerkIdentity } from './identity';
import { changeAdditionalAdmin } from './assignment';
import { studentSnapshot } from './snapshot';
loadEnvConfig(process.cwd(), true);
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || !['grant', 'revoke'].includes(args[0]))
    throw Error(
      'Usage: npm run dev:admin-role -- grant|revoke <exact-email-or-Clerk-user-id>',
    );
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: localSeedUrl(process.env) },
      { schema: 'public' },
    ),
  });
  try {
    await verifyDatabase(db);
    const clerkUserId = await resolveExistingClerkIdentity(args[1]);
    const user = await db.user.findUniqueOrThrow({
      where: { clerkUserId },
      select: { id: true },
    });
    const before = await studentSnapshot(db, user.id);
    const result = await changeAdditionalAdmin(
      db,
      user.id,
      args[0] as 'grant' | 'revoke',
    );
    const after = await studentSnapshot(db, user.id);
    if (before.digest !== after.digest)
      throw Error('Unexpected Student state change.');
    console.log(
      JSON.stringify(
        {
          database: 'mentoralm_dev',
          schema: 'public',
          operation: args[0],
          ...result,
          studentStateUnchanged: true,
          studentSnapshot: after,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Local ADMIN role operation failed. Verify exact existing identity and approved local Development configuration; sensitive details withheld.',
  );
  process.exitCode = 1;
});
