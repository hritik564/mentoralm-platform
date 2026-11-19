import 'server-only';
import type { PrismaClient } from '../../generated/prisma/client';
import { entitledStudentWhere } from './entitlement';
import { StudentError } from '../student/errors';
import { readStudentProfile, writeStudentProfile } from '../student/profile';

/** Narrow LMS profile access; never broadens unrelated Student APIs. */
export async function learnerProfile(
  db: PrismaClient,
  userId: string,
  input?: unknown,
) {
  return db.$transaction(
    async (tx) => {
      if (
        !(await tx.user.findFirst({
          where: entitledStudentWhere(userId),
          select: { id: true },
        }))
      )
        throw new StudentError('FORBIDDEN');
      return input === undefined
        ? readStudentProfile(tx, userId)
        : writeStudentProfile(tx, userId, input);
    },
    { isolationLevel: 'Serializable' },
  );
}
