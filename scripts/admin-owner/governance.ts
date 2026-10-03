import { loadEnvConfig } from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { localSeedUrl, verifyDatabase } from '../lms-owner/safety';
import { resolveExistingClerkIdentity } from './identity';
import { bootstrapGovernance } from './governance-bootstrap';
import { studentSnapshot } from './snapshot';
loadEnvConfig(process.cwd(), true);
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1)
    throw Error(
      'Usage: npm run dev:admin-governance -- <existing-email-or-Clerk-user-id>',
    );
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: localSeedUrl(process.env) },
      { schema: 'public' },
    ),
  });
  try {
    await verifyDatabase(db);
    const clerkUserId = await resolveExistingClerkIdentity(args[0]),
      u = await db.user.findUniqueOrThrow({ where: { clerkUserId } }),
      before = await studentSnapshot(db, u.id);
    const result = await bootstrapGovernance(db, u.id),
      after = await studentSnapshot(db, u.id);
    if (before.digest !== after.digest)
      throw Error('Unexpected Student history change');
    console.log(
      JSON.stringify(
        {
          database: 'mentoralm_dev',
          schema: 'public',
          ...result,
          authority: 'GOVERNANCE',
          primaryRole: after.primaryRole,
          studentStateUnchanged: true,
          studentHistoryDigest: after.digest,
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
    'Guarded local Governance bootstrap failed; sensitive details withheld.',
  );
  process.exitCode = 1;
});
