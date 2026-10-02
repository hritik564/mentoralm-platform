import 'server-only';
import { AcademicCatalog } from './catalog';
import {
  courseContext,
  sectionContext,
  itemContext,
  itemHasHistory,
  type TX,
} from './core';
import { parseInput } from '../validation';
import {
  courseInput,
  programInput,
  sectionInput,
  itemInput,
  orderInput,
} from './validation';
import {
  validatePublishedCourse,
  validatePublishedSection,
  validatePublishedItem,
} from './publication';
import { StudentError } from '../../student/errors';
async function nextPosition(
  tx: TX,
  kind: 'section' | 'item',
  parentId: string,
) {
  const row =
    kind === 'section'
      ? await tx.section.aggregate({
          where: { courseId: parentId },
          _max: { position: true },
        })
      : await tx.learningItem.aggregate({
          where: { sectionId: parentId },
          _max: { position: true },
        });
  const next = (row._max.position || 0) + 1;
  if (next >= 2147483647) throw new StudentError('CONFLICT');
  return next;
}
export class AcademicStructure extends AcademicCatalog {
  async saveProgram(id: string | null, input: unknown) {
    const c = parseInput(programInput, input);
    return this.write('ProgramSaved', async (tx) => {
      const old = id ? await tx.program.findUnique({ where: { id } }) : null;
      if (id && !old) throw new StudentError('NOT_FOUND');
      const row = id
        ? await tx.program.update({ where: { id }, data: c })
        : await tx.program.create({ data: c });
      return {
        value: row.id,
        targetId: row.id,
        details: { before: old?.title || null, after: row.title },
      };
    });
  }
  async saveCourse(id: string | null, input: unknown) {
    const c = parseInput(courseInput, input);
    return this.write('CourseSaved', async (tx) => {
      const old = id ? await courseContext(tx, id) : null;
      if (
        c.programId &&
        !(await tx.program.findUnique({ where: { id: c.programId } }))
      )
        throw new StudentError('NOT_FOUND');
      if (
        old &&
        (await tx.enrollment.count({ where: { courseId: id! } })) &&
        (
          [
            'academicCompletionEnabled',
            'certificateEnabled',
            'requiredAttendancePercent',
          ] as const
        ).some((k) => old[k] !== c[k])
      )
        throw new StudentError('CONFLICT');
      if (
        old &&
        old.programId !== c.programId &&
        (await tx.batchSession.count({
          where: {
            OR: [{ courseId: id! }, { item: { section: { courseId: id! } } }],
          },
        }))
      )
        throw new StudentError('CONFLICT');
      if (c.certificateEnabled && !c.academicCompletionEnabled)
        throw new StudentError('INVALID_INPUT');
      const row = id
        ? await tx.course.update({ where: { id }, data: c })
        : await tx.course.create({ data: c });
      if (c.published) await validatePublishedCourse(tx, row.id);
      return {
        value: row.id,
        targetId: row.id,
        details: {
          created: !old,
          titleChanged: old?.title !== c.title,
          metadataChanged: true,
          publishedBefore: old?.published || false,
          publishedAfter: c.published,
        },
      };
    });
  }
  async saveSection(courseId: string, id: string | null, input: unknown) {
    const c = parseInput(sectionInput, input);
    return this.write('SectionSaved', async (tx) => {
      await courseContext(tx, courseId);
      const old = id ? await sectionContext(tx, courseId, id) : null;
      if (!id && (await tx.section.count({ where: { courseId } })) >= 50)
        throw new StudentError('CONFLICT');
      const row = id
        ? await tx.section.update({ where: { id }, data: c })
        : await tx.section.create({
            data: {
              ...c,
              courseId,
              position: await nextPosition(tx, 'section', courseId),
            },
          });
      if (c.published) await validatePublishedSection(tx, row.id);
      return {
        value: row.id,
        targetId: row.id,
        details: {
          courseId,
          created: !old,
          titleChanged: old?.title !== c.title,
          publishedBefore: old?.published || false,
          publishedAfter: c.published,
        },
      };
    });
  }
  async saveItem(
    courseId: string,
    sectionId: string,
    id: string | null,
    input: unknown,
  ) {
    const c = parseInput(itemInput, input);
    return this.write('LearningItemSaved', async (tx) => {
      await sectionContext(tx, courseId, sectionId);
      const old = id ? await itemContext(tx, courseId, sectionId, id) : null;
      if (old && old.type !== c.type) throw new StudentError('CONFLICT');
      if (
        old &&
        old.required !== c.required &&
        (await itemHasHistory(tx, old.id))
      )
        throw new StudentError('CONFLICT');
      if (
        !id &&
        ((await tx.learningItem.count({ where: { sectionId } })) >= 100 ||
          (await tx.learningItem.count({ where: { section: { courseId } } })) >=
            500)
      )
        throw new StudentError('CONFLICT');
      const row = id
        ? await tx.learningItem.update({ where: { id }, data: c })
        : await tx.learningItem.create({
            data: {
              ...c,
              sectionId,
              position: await nextPosition(tx, 'item', sectionId),
            },
          });
      await tx.academicActivity.updateMany({
        where: { itemId: row.id },
        data: { published: c.published },
      });
      await tx.assignment.updateMany({
        where: { itemId: row.id },
        data: { published: c.published },
      });
      if (c.published) await validatePublishedItem(tx, row.id);
      return {
        value: row.id,
        targetId: row.id,
        details: {
          courseId,
          sectionId,
          type: c.type,
          created: !old,
          publishedBefore: old?.published || false,
          publishedAfter: c.published,
          requiredBefore: old?.required ?? null,
          requiredAfter: c.required,
        },
      };
    });
  }
  async order(
    courseId: string,
    sectionId: string | null,
    id: string,
    input: unknown,
  ) {
    const c = parseInput(orderInput, input);
    return this.write(
      sectionId ? 'LearningItemOrdered' : 'SectionOrdered',
      async (tx) => {
        const kind = sectionId ? 'item' : 'section';
        if (sectionId) await itemContext(tx, courseId, sectionId, id);
        else await sectionContext(tx, courseId, id);
        const rows = sectionId
          ? await tx.learningItem.findMany({
              where: { sectionId },
              orderBy: { position: 'asc' },
              select: { id: true, position: true },
            })
          : await tx.section.findMany({
              where: { courseId },
              orderBy: { position: 'asc' },
              select: { id: true, position: true },
            });
        const at = rows.findIndex((r) => r.id === id),
          other = rows[at + (c.direction === 'UP' ? -1 : 1)],
          old = rows[at];
        if (!other) throw new StudentError('CONFLICT');
        const temp = await nextPosition(tx, kind, sectionId || courseId);
        if (sectionId) {
          await tx.learningItem.update({
            where: { id },
            data: { position: temp },
          });
          await tx.learningItem.update({
            where: { id: other.id },
            data: { position: old.position },
          });
          await tx.learningItem.update({
            where: { id },
            data: { position: other.position },
          });
        } else {
          await tx.section.update({ where: { id }, data: { position: temp } });
          await tx.section.update({
            where: { id: other.id },
            data: { position: old.position },
          });
          await tx.section.update({
            where: { id },
            data: { position: other.position },
          });
        }
        return {
          value: id,
          targetId: id,
          details: {
            courseId,
            before: old.position,
            after: other.position,
            swappedWith: other.id,
          },
        };
      },
    );
  }
  async removeSection(courseId: string, id: string) {
    return this.write('SectionDeleted', async (tx) => {
      const s = await sectionContext(tx, courseId, id);
      if (
        s.published ||
        (await tx.learningItem.count({ where: { sectionId: id } }))
      )
        throw new StudentError('CONFLICT');
      await tx.section.delete({ where: { id } });
      return { value: id, targetId: id, details: { courseId, wasEmpty: true } };
    });
  }
  async removeItem(courseId: string, sectionId: string, id: string) {
    return this.write('LearningItemDeleted', async (tx) => {
      const i = await itemContext(tx, courseId, sectionId, id);
      if (
        i.published ||
        (await itemHasHistory(tx, id)) ||
        (await tx.certificate.count({ where: { courseId } })) ||
        (await tx.lesson.count({
          where: {
            itemId: id,
            OR: [
              { storageKey: { not: null } },
              { captionsStorageKey: { not: null } },
            ],
          },
        })) ||
        (await tx.learningResource.count({
          where: { itemId: id, storageKey: { not: null } },
        }))
      )
        throw new StudentError('CONFLICT');
      await tx.learningItem.delete({ where: { id } });
      return {
        value: id,
        targetId: id,
        details: { courseId, sectionId, type: i.type, noHistory: true },
      };
    });
  }
}
