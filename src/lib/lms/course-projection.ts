import type { Prisma } from '../../generated/prisma/client';
import { academicCompletion, assignmentCompletion } from './academic-rules';
import { learningProjection, itemProgress, type OutlineItem } from './progress';
export function outlineSelect(userId: string) {
  return {
    id: true,
    title: true,
    description: true,
    programId: true,
    academicCompletionEnabled: true,
    certificateEnabled: true,
    requiredAttendancePercent: true,
    program: { select: { title: true } },
    sections: {
      where: { published: true },
      orderBy: { position: 'asc' as const },
      select: {
        title: true,
        position: true,
        items: {
          where: { published: true },
          orderBy: { position: 'asc' as const },
          select: {
            id: true,
            title: true,
            type: true,
            required: true,
            activity: {
              select: {
                itemType: true,
                published: true,
                passingPercent: true,
                questions: {
                  select: { question: { select: { published: true } } },
                },
                attempts: {
                  where: { userId },
                  orderBy: { number: 'asc' as const },
                  select: {
                    status: true,
                    lastSavedAt: true,
                    submittedAt: true,
                    percentage: true,
                    requiresReview: true,
                  },
                },
              },
            },
            assignment: {
              select: {
                published: true,
                requiresAcceptance: true,
                submissions: {
                  where: { userId },
                  select: {
                    versions: {
                      orderBy: { number: 'desc' as const },
                      take: 1,
                      select: {
                        status: true,
                        submittedAt: true,
                        reviews: {
                          orderBy: { reviewedAt: 'desc' as const },
                          take: 1,
                          select: { reviewedAt: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            lesson: {
              select: {
                format: true,
                states: {
                  where: { userId },
                  select: { completedAt: true, lastAccessedAt: true },
                },
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.CourseSelect;
}
type OutlineRecord = Prisma.CourseGetPayload<{
  select: ReturnType<typeof outlineSelect>;
}>;
export function projectCourse(record: OutlineRecord) {
  const sections = record.sections.map((section) => {
    const items: OutlineItem[] = section.items.map((item) => {
      const completion =
        item.type === 'LESSON' && item.lesson
          ? {
              eligible: true,
              complete: !!item.lesson.states[0]?.completedAt,
              source: 'LESSON_MANUAL' as const,
              completedAt:
                item.lesson.states[0]?.completedAt?.toISOString() || null,
            }
          : item.activity &&
              (item.type === 'QUIZ' || item.type === 'ASSESSMENT')
            ? academicCompletion(
                item.type,
                item.activity.published,
                item.activity.questions.length > 0 &&
                  item.activity.questions.every((q) => q.question.published),
                item.activity.passingPercent,
                item.activity.attempts.filter((a) => a.submittedAt),
              )
            : item.assignment
              ? assignmentCompletion(
                  item.assignment.published,
                  item.assignment.requiresAcceptance,
                  item.assignment.submissions[0]?.versions[0],
                )
              : {
                  eligible: false,
                  complete: false,
                  source: null,
                  completedAt: null,
                };
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        required: item.required,
        inProgress:
          item.activity?.attempts.some((a) => a.status === 'IN_PROGRESS') ||
          false,
        lesson: item.lesson ? { format: item.lesson.format } : null,
        completion,
        completedAt: completion.completedAt,
        lastAccessedAt:
          item.lesson?.states[0]?.lastAccessedAt?.toISOString() ||
          [
            ...(item.activity?.attempts.map((a) =>
              (a.submittedAt && a.submittedAt > a.lastSavedAt
                ? a.submittedAt
                : a.lastSavedAt
              ).toISOString(),
            ) || []),
            ...(item.assignment?.submissions[0]?.versions.map((v) =>
              v.submittedAt.toISOString(),
            ) || []),
          ]
            .sort()
            .at(-1) ||
          null,
      };
    });
    return { ...section, items, progress: itemProgress(items) };
  });
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    hasAcademicItems: sections.some((s) =>
      s.items.some((i) => i.completion?.eligible && i.type !== 'LESSON'),
    ),
    programId: record.programId,
    academicCompletionEnabled: record.academicCompletionEnabled,
    certificateEnabled: record.certificateEnabled,
    requiredAttendancePercent: record.requiredAttendancePercent,
    program: record.program?.title || null,
    sections,
    progress: learningProjection(sections),
  };
}
