import 'server-only';
import type { Prisma } from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { courseAccessWhere } from './learning';
import { academicId } from './academic-rules';
export async function studentItem(
  db: Prisma.TransactionClient,
  userId: string,
  courseId: string,
  itemId: string,
  type?: 'QUIZ' | 'ASSESSMENT' | 'ASSIGNMENT',
) {
  if (
    !academicId.safeParse(courseId).success ||
    !academicId.safeParse(itemId).success
  )
    throw new StudentError('NOT_FOUND');
  const item = await db.learningItem.findFirst({
    where: {
      id: itemId,
      published: true,
      ...(type ? { type } : {}),
      section: { published: true, courseId, course: courseAccessWhere(userId) },
    },
    select: { id: true, title: true, type: true },
  });
  if (!item) throw new StudentError('NOT_FOUND');
  return item;
}
