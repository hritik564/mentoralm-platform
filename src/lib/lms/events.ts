import 'server-only';
import type { Prisma } from '../../generated/prisma/client';
export type LearningEventKind =
  | 'AssignmentPublished'
  | 'AssignmentReviewed'
  | 'QuizResultAvailable'
  | 'AssessmentResultAvailable'
  | 'SessionScheduled'
  | 'CourseCompleted'
  | 'CertificateIssued'
  | 'DiscussionReply';
/** A committed fact, never a delivery. Called in the owning domain transaction. */
export async function learningEvent(
  db: Prisma.TransactionClient,
  event: {
    kind: LearningEventKind;
    key: string;
    subjectId: string;
    courseId?: string;
    userId?: string;
  },
) {
  await db.learningEvent.upsert({
    where: { key: event.key },
    create: event,
    update: {},
  });
}
