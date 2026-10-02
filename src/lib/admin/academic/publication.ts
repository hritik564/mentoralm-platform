import 'server-only';
import { StudentError } from '../../student/errors';
import {
  approvedExternalLink,
  safeLessonContent,
  lessonMimes,
} from '../../lms/content';
import {
  openPrivateFile,
  validatePrivateContent,
} from '../../storage/private-files';
import { parseInput } from '../validation';
import { questionInput, assignmentInput } from './validation';
import type { TX } from './core';
export function validTextLesson(value: unknown) {
  const content = safeLessonContent(value);
  if (!content) return false;
  return content.blocks.every(
    (block) =>
      block.type === 'code' ||
      block.type === 'divider' ||
      (block.type === 'list' ? block.items : [block.text]).every(
        (t) => !/<\/?[a-z][^>]*>/i.test(t),
      ),
  );
}
export async function verifyMedia(
  storageKey: string | null,
  mimeType: string | null,
  format?: string,
) {
  if (
    !mimeType ||
    (format && !lessonMimes[format]?.includes(mimeType)) ||
    (!format &&
      !Object.values(lessonMimes)
        .flat()
        .filter((m) => !m.startsWith('video/'))
        .concat('text/plain')
        .includes(mimeType))
  )
    throw new StudentError('INVALID_INPUT');
  const { handle, size } = await openPrivateFile(
    process.env.LMS_FILES_ROOT,
    storageKey,
    mimeType.startsWith('video/') ? 2 * 1024 ** 3 : 25 * 1024 ** 2,
  );
  try {
    if (!size) throw new StudentError('INVALID_INPUT');
    const header = Buffer.alloc(16);
    await handle.read(header, 0, 16, 0);
    validatePrivateContent(header, mimeType);
  } finally {
    await handle.close();
  }
}
export async function validatePublishedItem(tx: TX, id: string) {
  const i = await tx.learningItem.findUnique({
    where: { id },
    include: {
      lesson: true,
      resource: true,
      assignment: true,
      activity: {
        include: {
          questions: {
            include: {
              question: {
                include: { options: { orderBy: { position: 'asc' } } },
              },
            },
          },
        },
      },
    },
  });
  if (!i) throw new StudentError('NOT_FOUND');
  if (i.type === 'LESSON') {
    const l = i.lesson;
    if (!l) throw new StudentError('INVALID_INPUT');
    if (l.format === 'TEXT') {
      const content = safeLessonContent(l.structuredContent);
      if (!content || !validTextLesson(content))
        throw new StudentError('INVALID_INPUT');
    } else if (l.format === 'EXTERNAL') {
      if (!approvedExternalLink(l.externalTargetId))
        throw new StudentError('INVALID_INPUT');
    } else {
      if (!l.fileName || (l.format === 'IMAGE' && !l.altText))
        throw new StudentError('INVALID_INPUT');
      await verifyMedia(l.storageKey, l.mimeType, l.format);
    }
  } else if (i.type === 'RESOURCE') {
    if (!i.resource?.fileName) throw new StudentError('INVALID_INPUT');
    await verifyMedia(i.resource.storageKey, i.resource.mimeType);
  } else if (i.type === 'QUIZ' || i.type === 'ASSESSMENT') {
    const a = i.activity;
    if (
      !a ||
      a.itemType !== i.type ||
      (i.published && !a.published) ||
      !a.instructions.trim() ||
      !a.questions.length ||
      a.questions.length > 100
    )
      throw new StudentError('INVALID_INPUT');
    for (const q of a.questions) {
      if (!q.question.published) throw new StudentError('INVALID_INPUT');
      parseInput(questionInput, {
        type: q.question.type,
        prompt: q.question.prompt,
        explanation: q.question.explanation,
        published: true,
        options: q.question.options.map((o) => ({
          label: o.label,
          correct: o.correct,
        })),
      });
    }
  } else if (i.type === 'ASSIGNMENT') {
    if (!i.assignment || (i.published && !i.assignment.published))
      throw new StudentError('INVALID_INPUT');
    const {
      instructions,
      dueAt,
      allowedKinds,
      maxFiles,
      maxFileBytes,
      requiresAcceptance,
      allowResubmission,
    } = i.assignment;
    parseInput(assignmentInput, {
      instructions,
      dueAt: dueAt?.toISOString() || null,
      allowedKinds,
      maxFiles,
      maxFileBytes,
      requiresAcceptance,
      allowResubmission,
    });
  }
  // LIVE_SESSION is an academic placeholder; zero or many Batch occurrences are valid.
}
export async function validatePublishedSection(tx: TX, id: string) {
  const items = await tx.learningItem.findMany({
    where: { sectionId: id, published: true },
    select: { id: true },
    take: 101,
  });
  if (!items.length || items.length > 100)
    throw new StudentError('INVALID_INPUT');
  for (const i of items) await validatePublishedItem(tx, i.id);
}
export async function validatePublishedCourse(tx: TX, id: string) {
  const sections = await tx.section.findMany({
    where: { courseId: id, published: true },
    select: { id: true },
    take: 51,
  });
  if (!sections.length || sections.length > 50)
    throw new StudentError('INVALID_INPUT');
  for (const s of sections) await validatePublishedSection(tx, s.id);
}
