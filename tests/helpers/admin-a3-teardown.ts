import { Client } from 'pg';
import { createClerkClient } from '@clerk/backend';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, basename } from 'node:path';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { testDatabaseUrl } from './d4-database';
import { localSeedUrl, verifyDatabase } from '../../scripts/lms-owner/safety';
import { studentSnapshot } from '../../scripts/admin-owner/snapshot';
export default async function teardown() {
  const schema = process.env.A3_TEST_SCHEMA;
  if (!schema || !/^d4_[a-f0-9]{24}$/.test(schema))
    throw Error('Invalid A3 teardown schema');
  const configured = testDatabaseUrl();
  if (!configured) throw Error('A3 isolated Test database required');
  const reviewDirectory = `docs/reviews/admin-${process.env.ADMIN_REVIEW_PHASE === 'a4' ? 'a4' : 'a3'}`;
  const metadataPath = `${reviewDirectory}/fixture.json`;
  const f = JSON.parse(await readFile(metadataPath, 'utf8')) as {
    schema: string;
    ownerClerkId: string;
    studentClerkId: string;
    filesRoot?: string;
    before?: Awaited<ReturnType<typeof studentSnapshot>>;
  };
  if (f.schema !== schema) throw Error('A3 teardown fixture mismatch');
  const db = new Client({ connectionString: configured }),
    dev = new PrismaClient({
      adapter: new PrismaPg({ connectionString: localSeedUrl(process.env) }),
    });
  try {
    await verifyDatabase(dev);
    const owner = await dev.user.findUniqueOrThrow({
        where: { clerkUserId: f.ownerClerkId },
      }),
      after = await studentSnapshot(dev, owner.id),
      baseline =
        f.before ||
        (
          JSON.parse(
            await readFile(
              'docs/reviews/admin-a2/owner-student-preservation.json',
              'utf8',
            ),
          ) as { after: typeof after }
        ).after;
    if (JSON.stringify(after) !== JSON.stringify(baseline))
      throw Error('Owner Student history changed');
    await writeFile(
      `${reviewDirectory}/owner-student-preservation.json`,
      JSON.stringify({ before: baseline, after, unchanged: true }, null, 2),
    );
    await db.connect();
    const identity = await db.query('SELECT current_database() AS database');
    if (
      identity.rows[0]?.database !==
      decodeURIComponent(new URL(configured).pathname.slice(1))
    )
      throw Error('Test identity mismatch');
    // Only the generated disposable schema, including immutable review history, is removed.
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const temporary = await clerk.users.getUser(f.studentClerkId);
    if (
      !temporary.emailAddresses.every((e) =>
        /^a3-[a-f0-9-]+\+clerk_test@example\.com$/.test(e.emailAddress),
      )
    )
      throw Error('Temporary identity mismatch');
    await clerk.users.deleteUser(temporary.id);
    if (f.filesRoot) {
      if (
        resolve(dirname(f.filesRoot)) !== resolve(tmpdir()) ||
        !/^mentoralm-a3-browser-[a-zA-Z0-9]+$/.test(basename(f.filesRoot))
      )
        throw Error('Temporary files path mismatch');
      await rm(f.filesRoot, { recursive: true, force: true });
    }
    await rm(metadataPath, { force: true });
  } finally {
    await db.end();
    await dev.$disconnect();
  }
}
