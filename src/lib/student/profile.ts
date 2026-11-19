import 'server-only';
import type { Prisma } from '../../generated/prisma/client';
import { profileInput } from './validation';
import { StudentError } from './errors';

export function readStudentProfile(
  db: Prisma.TransactionClient,
  userId: string,
) {
  return db.studentProfile.findUnique({
    where: { userId },
    select: {
      educationLevel: true,
      institution: true,
      graduationYear: true,
      interests: true,
      careerGoals: true,
    },
  });
}
/** Canonical optional education fields; caller must independently authorize the persisted owner. */
export async function writeStudentProfile(
  db: Prisma.TransactionClient,
  userId: string,
  input: unknown,
) {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) throw new StudentError('INVALID_INPUT');
  const {
    educationLevel,
    institution,
    graduationYear,
    interests,
    careerGoals,
  } = parsed.data;
  const writable = {
    educationLevel,
    institution,
    graduationYear,
    interests,
    careerGoals,
  };
  await db.studentProfile.upsert({
    where: { userId },
    create: { userId, ...writable },
    update: writable,
  });
  return readStudentProfile(db, userId);
}
