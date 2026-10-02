import 'server-only';
import { AcademicStructure } from './structure';
import { itemContext } from './core';
import { parseInput } from '../validation';
import {
  lessonInput,
  resourceInput,
  activityInput,
  assignmentInput,
  programInput,
  questionInput,
} from './validation';
import { validatePublishedItem, validTextLesson } from './publication';
import { approvedExternalLink } from '../../lms/content';
import { StudentError } from '../../student/errors';
import type { Prisma } from '../../../generated/prisma/client';
export class AcademicAuthoring extends AcademicStructure {
  async saveLesson(
    courseId: string,
    sectionId: string,
    itemId: string,
    input: unknown,
  ) {
    const c = parseInput(lessonInput, input);
    if (c.format === 'TEXT' && !validTextLesson(c.structuredContent))
      throw new StudentError('INVALID_INPUT');
    if (c.format === 'EXTERNAL' && !approvedExternalLink(c.externalTargetId))
      throw new StudentError('INVALID_INPUT');
    return this.write('LessonSaved', async (tx) => {
      const i = await itemContext(tx, courseId, sectionId, itemId);
      if (i.type !== 'LESSON') throw new StudentError('INVALID_INPUT');
      const old = await tx.lesson.findUnique({ where: { itemId } });
      // Existing private assets must be explicitly replaced through the protected attachment path, never orphaned by a format switch.
      if (
        old &&
        old.format !== c.format &&
        (old.storageKey || old.captionsStorageKey)
      )
        throw new StudentError('CONFLICT');
      const data = {
        ...c,
        structuredContent:
          c.format === 'TEXT' ? c.structuredContent : undefined,
        externalTargetId: c.format === 'EXTERNAL' ? c.externalTargetId : null,
      };
      await tx.lesson.upsert({
        where: { itemId },
        create: { ...data, itemId },
        update: data,
      });
      if (i.published) await validatePublishedItem(tx, itemId);
      return {
        value: itemId,
        targetId: itemId,
        details: {
          courseId,
          formatBefore: old?.format || null,
          formatAfter: c.format,
          contentChanged: true,
        },
      };
    });
  }
  async saveResource(
    courseId: string,
    sectionId: string,
    itemId: string,
    input: unknown,
  ) {
    const c = parseInput(resourceInput, input);
    return this.write('LearningResourceSaved', async (tx) => {
      const i = await itemContext(tx, courseId, sectionId, itemId);
      if (i.type !== 'RESOURCE') throw new StudentError('INVALID_INPUT');
      const old = await tx.learningResource.findUnique({ where: { itemId } });
      if (!old) throw new StudentError('CONFLICT');
      await tx.learningResource.update({ where: { itemId }, data: c });
      if (i.published) await validatePublishedItem(tx, itemId);
      return {
        value: itemId,
        targetId: itemId,
        details: {
          courseId,
          metadataChanged: true,
          downloadAllowed: c.downloadAllowed,
        },
      };
    });
  }
  async saveActivity(
    courseId: string,
    sectionId: string,
    itemId: string,
    input: unknown,
  ) {
    const c = parseInput(activityInput, input);
    return this.write('AcademicActivitySaved', async (tx) => {
      const i = await itemContext(tx, courseId, sectionId, itemId);
      if (!['QUIZ', 'ASSESSMENT'].includes(i.type))
        throw new StudentError('INVALID_INPUT');
      const questions = await tx.question.findMany({
        where: { id: { in: c.questions.map((q) => q.questionId) } },
      });
      if (questions.length !== c.questions.length)
        throw new StudentError('NOT_FOUND');
      const old = await tx.academicActivity.findUnique({ where: { itemId } });
      const { questions: selected, ...data } = c;
      await tx.academicActivity.upsert({
        where: { itemId },
        create: { itemId, itemType: i.type, ...data, published: i.published },
        update: { ...data, published: i.published },
      });
      await tx.activityQuestion.deleteMany({ where: { activityId: itemId } });
      await tx.activityQuestion.createMany({
        data: selected.map((q, n) => ({
          activityId: itemId,
          questionId: q.questionId,
          points: q.points,
          position: n + 1,
        })),
      });
      if (i.published) await validatePublishedItem(tx, itemId);
      return {
        value: itemId,
        targetId: itemId,
        details: {
          courseId,
          kind: i.type,
          created: !old,
          questionCount: selected.length,
          passingBefore: old?.passingPercent ?? null,
          passingAfter: c.passingPercent,
          attemptsPreserved: true,
        },
      };
    });
  }
  async saveAssignment(
    courseId: string,
    sectionId: string,
    itemId: string,
    input: unknown,
  ) {
    const c = parseInput(assignmentInput, input);
    return this.write('AssignmentSaved', async (tx) => {
      const i = await itemContext(tx, courseId, sectionId, itemId);
      if (i.type !== 'ASSIGNMENT') throw new StudentError('INVALID_INPUT');
      const old = await tx.assignment.findUnique({ where: { itemId } });
      if (
        old &&
        (await tx.assignmentSubmission.count({
          where: { assignmentId: itemId },
        })) &&
        old.requiresAcceptance !== c.requiresAcceptance
      )
        throw new StudentError('CONFLICT');
      const data = { ...c, dueAt: c.dueAt ? new Date(c.dueAt) : null };
      await tx.assignment.upsert({
        where: { itemId },
        create: { ...data, itemId, published: i.published },
        update: { ...data, published: i.published },
      });
      if (i.published) await validatePublishedItem(tx, itemId);
      return {
        value: itemId,
        targetId: itemId,
        details: {
          courseId,
          created: !old,
          instructionsChanged: true,
          allowedKinds: c.allowedKinds,
          requiresAcceptance: c.requiresAcceptance,
          submissionsPreserved: true,
        },
      };
    });
  }
  async saveBank(id: string | null, input: unknown) {
    const c = parseInput(programInput, input);
    return this.write('QuestionBankSaved', async (tx) => {
      const old = id
        ? await tx.questionBank.findUnique({ where: { id } })
        : null;
      if (id && !old) throw new StudentError('NOT_FOUND');
      const row = id
        ? await tx.questionBank.update({ where: { id }, data: c })
        : await tx.questionBank.create({ data: c });
      return {
        value: row.id,
        targetId: row.id,
        details: { before: old?.title || null, after: row.title },
      };
    });
  }
  async saveQuestion(bankId: string, id: string | null, input: unknown) {
    const c = parseInput(questionInput, input);
    return this.write('QuestionSaved', async (tx) => {
      if (!(await tx.questionBank.findUnique({ where: { id: bankId } })))
        throw new StudentError('NOT_FOUND');
      const old = id
        ? await tx.question.findFirst({ where: { id, bankId } })
        : null;
      if (id && !old) throw new StudentError('NOT_FOUND');
      if (old && old.type !== c.type) throw new StudentError('CONFLICT');
      if (
        old &&
        !c.published &&
        (await tx.activityQuestion.count({
          where: { questionId: id!, activity: { published: true } },
        }))
      )
        throw new StudentError('CONFLICT');
      const { options, ...data } = c;
      const max = await tx.question.aggregate({
        where: { bankId },
        _max: { position: true },
      });
      if ((max._max.position || 0) >= 2147483646)
        throw new StudentError('CONFLICT');
      const row = id
        ? await tx.question.update({ where: { id }, data })
        : await tx.question.create({
            data: { ...data, bankId, position: (max._max.position || 0) + 1 },
          });
      await tx.questionOption.deleteMany({ where: { questionId: row.id } });
      await tx.questionOption.createMany({
        data: options.map((o, n) => ({
          ...o,
          questionId: row.id,
          position: n + 1,
        })),
      });
      return {
        value: row.id,
        targetId: row.id,
        details: {
          bankId,
          created: !old,
          type: c.type,
          publishedBefore: old?.published || false,
          publishedAfter: c.published,
          answerConfigurationChanged: true,
          snapshotsPreserved: true,
        } as Prisma.InputJsonObject,
      };
    });
  }
}
