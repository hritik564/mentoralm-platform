import { loadEnvConfig } from '@next/env';
import { localSeedUrl, verifyDatabase } from '../lms-owner/safety';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { reconcilePendingCommerce } from '../../src/lib/marketplace/commerce/admin';
import { razorpayGateway } from '../../src/lib/marketplace/commerce/config';
loadEnvConfig(process.cwd(), true);
async function main() {
  const url = localSeedUrl(process.env),
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await verifyDatabase(db);
    const clerkUserId = process.env.MARKETPLACE_OPERATOR_CLERK_ID;
    if (!clerkUserId || !/^user_[A-Za-z0-9]+$/.test(clerkUserId)) throw Error();
    const user = await db.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });
    if (!user) throw Error();
    const args = process.argv.slice(2);
    if (args.length) throw Error();
    console.info(
      JSON.stringify(
        await reconcilePendingCommerce(db, razorpayGateway(), user.id),
      ),
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Guarded local commerce reconciliation refused or failed; private details withheld.',
  );
  process.exitCode = 1;
});
