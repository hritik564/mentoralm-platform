// Isolated browser fixture helper. It is never imported by app/runtime routes.
import { testDatabaseUrl } from './d4-database';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AcademicStaff } from '../../src/lib/lms/academic-staff';
const schema = process.env.D4_TEST_SCHEMA;
if (!schema || !/^d4_[a-f0-9]{24}$/.test(schema))
  throw Error('Isolated schema required');
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: testDatabaseUrl()! }, { schema }),
});
async function main() {
  const args = JSON.parse(process.argv[2]) as {
    actorId: string;
    versionId?: string;
    status: 'CHANGES_REQUESTED' | 'ACCEPTED';
    feedback: string;
    batchId: string;
    sessionId?: string;
    membershipId?: string;
  };
  const service = new AcademicStaff(db, args.actorId);
  if (args.versionId)
    await service.review(
      args.versionId,
      args.status,
      args.feedback,
      args.batchId,
    );
  else if (args.sessionId && args.membershipId)
    await service.attendance(args.sessionId, args.membershipId, 'PRESENT');
  else throw Error('Invalid fixture operation');
}
main()
  .catch(() => {
    process.exitCode = 1;
    console.error('Scoped fixture operation failed');
  })
  .finally(() => db.$disconnect());
