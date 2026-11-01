import { randomUUID, createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import type { Prisma } from '../../src/generated/prisma/client';
import { neonDirectUrl } from '../../src/lib/production/config';
import { governanceTransaction } from '../../src/lib/admin/governance/access';
import {
  migrationsReady,
  type MigrationRow,
} from '../../src/lib/production/readiness';

type Input = {
  clerkUserId: string;
  confirmStudentId: string;
  confirmProduction: string;
  execute: string;
  changeTicket: string;
  backupReference: string;
  backupTimestamp: string;
};

async function studentSnapshot(
  db: Prisma.TransactionClient,
  userId: string,
) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      memberships: true,
      enrollments: true,
      attendance: true,
      lessonStates: true,
      academicAttempts: { include: { responses: true } },
      submissions: { include: { versions: true } },
      certificates: true,
    },
  });

  function canonical(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();

    if (Array.isArray(value))
      return value
        .map(canonical)
        .sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        );

    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, canonical(item)]),
      );

    return value;
  }

  return {
    primaryRole: user.role,
    studentId: user.studentId,
    digest: createHash('sha256')
      .update(JSON.stringify(canonical(user)))
      .digest('hex'),
  };
}

function parseInput(args: string[]): Input {
  const allowed = new Set([
    'clerk-user-id',
    'confirm-student-id',
    'confirm-production',
    'execute',
    'change-ticket',
    'backup-reference',
    'backup-timestamp',
  ]);

  const values = new Map<string, string>();

  for (const arg of args) {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);

    if (!match || !allowed.has(match[1]) || values.has(match[1])) {
      throw Error('Invalid operator input.');
    }

    values.set(match[1], match[2]);
  }

  const clerkUserId = values.get('clerk-user-id') || '';
  const confirmStudentId = values.get('confirm-student-id') || '';
  const confirmProduction = values.get('confirm-production') || '';
  const execute = values.get('execute') || '';
  const changeTicket = values.get('change-ticket') || '';
  const backupReference = values.get('backup-reference') || '';
  const backupTimestamp = values.get('backup-timestamp') || '';

  if (!/^user_[a-zA-Z0-9]+$/.test(clerkUserId))
    throw Error('Exact existing Clerk user ID required.');

  if (!/^ST-\d{4}-\d{6}$/.test(confirmStudentId))
    throw Error('Exact production Student ID required.');

  if (confirmProduction !== 'mentoralm')
    throw Error('Production database confirmation required.');

  if (execute !== 'FIRST_GOVERNOR')
    throw Error('Explicit first-Governor execution confirmation required.');

  if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(changeTicket))
    throw Error('Valid change ticket required.');

  if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(backupReference))
    throw Error('Valid backup reference required.');

  const backupTime = Date.parse(backupTimestamp);
  const backupAge = Date.now() - backupTime;

  if (
    !Number.isFinite(backupTime) ||
    backupAge < 0 ||
    backupAge > 86_400_000
  ) {
    throw Error('Recent verified backup evidence required.');
  }

  return {
    clerkUserId,
    confirmStudentId,
    confirmProduction,
    execute,
    changeTicket,
    backupReference,
    backupTimestamp,
  };
}

async function main() {
  const input = parseInput(process.argv.slice(2));

  const rawUrl = process.env.MENTORALM_PRODUCTION_DATABASE_URL;

  if (!rawUrl)
    throw Error('MENTORALM_PRODUCTION_DATABASE_URL is required.');

  // Uses the same production boundary already enforced by the application:
  // direct Neon, Singapore, strict TLS, exact mentoralm database.
  const productionUrl = neonDirectUrl(rawUrl, 'mentoralm');

  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: productionUrl.toString() },
      { schema: 'public' },
    ),
  });

  try {
    /*
     * Preflight identity check.
     */
    const identity = await db.$queryRaw<
      { name: string; schema: string; dbUser: string }[]
    >`
      SELECT
        current_database() AS name,
        current_schema() AS schema,
        current_user AS "dbUser"
    `;

    if (
      identity.length !== 1 ||
      identity[0].name !== 'mentoralm' ||
      identity[0].schema !== 'public' ||
      identity[0].dbUser !== 'mentoralm_runtime'
    ) {
      throw Error('Connected production target mismatch.');
    }

    /*
     * Production must already be at the approved migration state.
     * This operator never runs migrations.
     */
    const migrationRows = await db.$queryRaw<MigrationRow[]>`
      SELECT
        migration_name,
        checksum,
        finished_at,
        rolled_back_at
      FROM public."_prisma_migrations"
    `;

    if (!migrationsReady(migrationRows))
      throw Error('Production migration state is not approved.');

    /*
     * Everything security-sensitive below occurs under the existing
     * Serializable transaction + PostgreSQL advisory transaction lock.
     */
    const result = await governanceTransaction(db, async (tx) => {
      /*
       * Re-check target identity inside the locked transaction.
       */
      const target = await tx.user.findUnique({
        where: { clerkUserId: input.clerkUserId },
        include: {
          roleAssignments: true,
          adminAuthorization: true,
        },
      });

      if (!target)
        throw Error('Target production user does not exist.');

      /*
       * First-Governor operator is deliberately one-shot.
       *
       * We expect an ordinary production student identity:
       * - primary role remains STUDENT
       * - no ADMIN additional role
       * - no existing AdminAuthorization
       */
      if (
        target.role !== 'STUDENT' ||
        !target.studentId ||
        target.studentId !== input.confirmStudentId ||
        target.roleAssignments.some((r) => r.role === 'ADMIN') ||
        target.adminAuthorization
      ) {
        throw Error('Target user is not eligible for first Governor bootstrap.');
      }

      const beforeStudent = await studentSnapshot(tx, target.id);

      /*
       * Refuse to bootstrap if ANY effective administrator already exists.
       * If this condition ever fails, normal Governance controls must be used.
       */
      const existingAdmins = await tx.user.count({
        where: {
          OR: [
            { role: 'ADMIN' },
            { roleAssignments: { some: { role: 'ADMIN' } } },
          ],
        },
      });

      if (existingAdmins !== 0)
        throw Error('Existing administrator detected.');

      const existingGovernors = await tx.adminAuthorization.count({
        where: { authority: 'GOVERNANCE' },
      });

      if (existingGovernors !== 0)
        throw Error('Existing Governor detected.');

      /*
       * Stage 1:
       * Preserve STUDENT as the primary role and add ADMIN as an
       * additional role.
       */
      await tx.userRoleAssignment.create({
        data: {
          userId: target.id,
          role: 'ADMIN',
        },
      });

      /*
       * Stage 2:
       * Establish the normal initial SCOPED policy first.
       */
      const scopedPolicy = await tx.adminAuthorization.create({
        data: {
          userId: target.id,
          authority: 'SCOPED',
          permissions: [],
          revision: randomUUID(),
        },
      });

      await tx.academicAudit.create({
        data: {
          actorId: target.id,
          targetId: target.id,
          action: 'PRODUCTION_FIRST_ADMIN_BOOTSTRAP',
          details: {
            source: 'trusted-production-operator',
            changeTicket: input.changeTicket,
            backupReference: input.backupReference,
            backupTimestamp: input.backupTimestamp,
            primaryRole: target.role,
            additionalRole: 'ADMIN',
            beforeAuthority: null,
            afterAuthority: 'SCOPED',
            previousRevision: null,
            scopedRevision: scopedPolicy.revision,
          },
        },
      });

      /*
       * Stage 3:
       * Promote the newly established policy to GOVERNANCE.
       *
       * Governors intentionally have an empty explicit permission list;
       * authority is derived from GOVERNANCE itself.
       */
      const governanceRevision = randomUUID();

      const promoted = await tx.adminAuthorization.updateMany({
        where: {
          userId: target.id,
          authority: 'SCOPED',
          revision: scopedPolicy.revision,
        },
        data: {
          authority: 'GOVERNANCE',
          permissions: [],
          revision: governanceRevision,
        },
      });

      if (promoted.count !== 1)
        throw Error('Governor promotion conflict.');

      await tx.academicAudit.create({
        data: {
          actorId: target.id,
          targetId: target.id,
          action: 'PRODUCTION_FIRST_GOVERNOR_BOOTSTRAP',
          details: {
            source: 'trusted-production-operator',
            changeTicket: input.changeTicket,
            backupReference: input.backupReference,
            backupTimestamp: input.backupTimestamp,
            beforeAuthority: 'SCOPED',
            afterAuthority: 'GOVERNANCE',
            previousRevision: scopedPolicy.revision,
            governanceRevision,
          },
        },
      });

      /*
       * Final invariants while still inside the transaction.
       */
      const finalUser = await tx.user.findUniqueOrThrow({
        where: { id: target.id },
        include: {
          roleAssignments: true,
          adminAuthorization: true,
        },
      });

      const finalAdminCount = await tx.user.count({
        where: {
          OR: [
            { role: 'ADMIN' },
            { roleAssignments: { some: { role: 'ADMIN' } } },
          ],
        },
      });

      const finalGovernorCount = await tx.adminAuthorization.count({
        where: {
          authority: 'GOVERNANCE',
          userId: target.id,
        },
      });

      const afterStudent = await studentSnapshot(tx, target.id);

      if (
        beforeStudent.digest !== afterStudent.digest ||
        beforeStudent.primaryRole !== afterStudent.primaryRole ||
        beforeStudent.studentId !== afterStudent.studentId
      ) {
        throw Error('Unexpected Student history change.');
      }

      if (
        finalUser.role !== 'STUDENT' ||
        !finalUser.roleAssignments.some((r) => r.role === 'ADMIN') ||
        finalUser.adminAuthorization?.authority !== 'GOVERNANCE' ||
        finalUser.adminAuthorization.permissions.length !== 0 ||
        finalAdminCount !== 1 ||
        finalGovernorCount !== 1
      ) {
        throw Error('Final Governor invariants failed.');
      }

      return {
        userId: target.id,
        studentId: target.studentId,
        primaryRole: finalUser.role,
        additionalRole: 'ADMIN',
        authority: finalUser.adminAuthorization.authority,
        studentStateUnchanged: true,
      };
    });

    console.log(
      JSON.stringify(
        {
          result: 'FIRST_PRODUCTION_GOVERNOR_BOOTSTRAPPED',
          database: 'mentoralm',
          schema: 'public',
          ...result,
          changeTicket: input.changeTicket,
          backupReference: input.backupReference,
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
    'Production first-Governor bootstrap refused or failed. Sensitive diagnostics withheld. No partial bootstrap should be assumed.',
  );
  process.exitCode = 1;
});
