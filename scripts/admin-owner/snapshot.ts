import type { PrismaClient } from '../../src/generated/prisma/client';
import { createHash } from 'node:crypto';
/** Local owner verification only. Return a digest rather than expose private academic history. */
export async function studentSnapshot(db: PrismaClient, id: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id },
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
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, canonical(v)]),
      );
    return value;
  }
  return {
    primaryRole: user.role,
    studentId: user.studentId,
    memberships: user.memberships.length,
    enrollments: user.enrollments.length,
    attendance: user.attendance.length,
    lessonStates: user.lessonStates.length,
    attempts: user.academicAttempts.length,
    submissions: user.submissions.length,
    certificates: user.certificates.length,
    digest: createHash('sha256')
      .update(JSON.stringify(canonical(user)))
      .digest('hex'),
  };
}
