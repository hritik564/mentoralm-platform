import { loadEnvConfig } from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { localSeedUrl, verifyDatabase } from '../lms-owner/safety';
import { resolveExistingClerkIdentity } from './identity';
import { AcademicMedia } from '../../src/lib/admin/academic/media';
loadEnvConfig(process.cwd(), true);
async function main() {
  const identity = process.argv[2];
  if (process.argv.length !== 3 || !identity)
    throw Error(
      'Exact existing Admin identity required. Stop active authoring before repair.',
    );
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: localSeedUrl(process.env) },
      { schema: 'public' },
    ),
  });
  try {
    await verifyDatabase(db);
    const clerkUserId = await resolveExistingClerkIdentity(identity),
      actor = await db.user.findUniqueOrThrow({
        where: { clerkUserId },
        select: { id: true },
      });
    console.log(await new AcademicMedia(db, actor.id).reconcile());
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Guarded academic asset reconciliation failed; sensitive details withheld.',
  );
  process.exitCode = 1;
});
