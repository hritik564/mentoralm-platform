import { withRequestContext } from '@/lib/production/request-context';
import { requireAdminActor } from '@/lib/admin/session';
import { getDatabase } from '@/lib/db/client';
import { AcademicAuthoring } from '@/lib/admin/academic/authoring';
import { AcademicMedia } from '@/lib/admin/academic/media';
import { adminResponse } from '@/lib/admin/http';
import { adminHandle, adminId } from '@/lib/admin/handles';
import { privateJson, requestBody } from '@/lib/student/http';
import { StudentError } from '@/lib/student/errors';
import { mutationLimiter } from '@/lib/student/abuse';
import { parseInput, sessionInput } from '@/lib/admin/validation';
import { deleteInput } from '@/lib/admin/academic/validation';
import { AdminOperations } from '@/lib/admin/operations';
import { multipartBody } from '@/lib/storage/submissions';
export const dynamic = 'force-dynamic';
async function handler(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return withRequestContext(request, () =>
    adminResponse(async () => {
      const actor = await requireAdminActor(),
        db = getDatabase(),
        repo = new AcademicAuthoring(db, actor.id),
        { path } = await params;
      await repo.authorize();
      const [area, ref, sub, subref, nested, itemref, action] = path,
        q = Object.fromEntries(new URL(request.url).searchParams);
      const courseId =
        area === 'courses' && ref ? adminId('course', ref) : null;
      const sectionId =
        area === 'courses' && sub === 'sections' && subref
          ? adminId('section', subref)
          : null;
      const itemId =
        sectionId && nested === 'items' && itemref
          ? adminId('item', itemref)
          : null;
      if (request.method === 'GET') {
        if (path.length === 1) {
          if (area === 'programs') return privateJson(await repo.programs(q));
          if (area === 'courses')
            return privateJson(
              await repo.courses({
                ...q,
                program: q.program ? adminId('program', q.program) : undefined,
              }),
            );
          if (area === 'banks') return privateJson(await repo.banks(q));
          if (area === 'activities')
            return privateJson(await repo.activities(q));
          if (area === 'live-batches' && q.course)
            return privateJson(
              await repo.liveBatches(adminId('course', q.course)),
            );
        }
        if (path.length === 2 && area === 'courses')
          return privateJson(await repo.builder(courseId!));
        if (path.length === 2 && area === 'banks')
          return privateJson(await repo.bank(adminId('bank', ref), q));
        if (path.length === 6 && itemId)
          return privateJson(await repo.item(courseId!, sectionId!, itemId));
        throw new StudentError('NOT_FOUND');
      }
      if (request.method !== 'POST') throw new StudentError('NOT_FOUND');
      await mutationLimiter.check(actor.id, 'academic');
      if (path.length === 7 && itemId && action === 'media') {
        await mutationLimiter.check(actor.id, 'upload');
        const form = await multipartBody(request);
        if ([...form.keys()].length !== 1)
          throw new StudentError('INVALID_INPUT');
        const file = form.get('file');
        if (!(file instanceof File)) throw new StudentError('INVALID_INPUT');
        return privateJson(
          await new AcademicMedia(db, actor.id).attach(
            courseId!,
            sectionId!,
            itemId,
            file,
          ),
        );
      }
      const raw = await requestBody(request);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new StudentError('INVALID_INPUT');
      const draft = raw as Record<string, unknown>;
      let id: string,
        kind: 'program' | 'course' | 'section' | 'item' | 'bank' | 'question';
      if (area === 'programs' && path.length <= 2) {
        kind = 'program';
        id = await repo.saveProgram(ref ? adminId(kind, ref) : null, draft);
      } else if (area === 'courses' && path.length <= 2) {
        kind = 'course';
        id = await repo.saveCourse(courseId, {
          ...draft,
          programId: draft.programId
            ? adminId('program', String(draft.programId))
            : null,
        });
      } else if (area === 'banks' && path.length <= 2) {
        kind = 'bank';
        id = await repo.saveBank(ref ? adminId(kind, ref) : null, draft);
      } else if (
        area === 'banks' &&
        sub === 'questions' &&
        [3, 4].includes(path.length)
      ) {
        kind = 'question';
        id = await repo.saveQuestion(
          adminId('bank', ref),
          subref ? adminId(kind, subref) : null,
          draft,
        );
      } else if (
        courseId &&
        sub === 'sections' &&
        [3, 4].includes(path.length)
      ) {
        kind = 'section';
        id = await repo.saveSection(courseId, sectionId, draft);
      } else if (
        courseId &&
        sectionId &&
        path.length === 5 &&
        nested === 'order'
      ) {
        kind = 'section';
        id = await repo.order(courseId, null, sectionId, draft);
      } else if (
        courseId &&
        sectionId &&
        path.length === 5 &&
        nested === 'delete'
      ) {
        parseInput(deleteInput, draft);
        kind = 'section';
        id = await repo.removeSection(courseId, sectionId);
      } else if (
        courseId &&
        sectionId &&
        nested === 'items' &&
        [5, 6].includes(path.length)
      ) {
        kind = 'item';
        id = await repo.saveItem(courseId, sectionId, itemId, draft);
      } else if (courseId && sectionId && itemId && path.length === 7) {
        kind = 'item';
        if (action === 'lesson')
          id = await repo.saveLesson(courseId, sectionId, itemId, draft);
        else if (action === 'resource')
          id = await repo.saveResource(courseId, sectionId, itemId, draft);
        else if (action === 'activity') {
          const questions = Array.isArray(draft.questions)
            ? draft.questions.map((q) => {
                if (!q || typeof q !== 'object')
                  throw new StudentError('INVALID_INPUT');
                const v = q as Record<string, unknown>;
                return {
                  ...v,
                  questionId: adminId('question', String(v.questionId)),
                };
              })
            : draft.questions;
          id = await repo.saveActivity(courseId, sectionId, itemId, {
            ...draft,
            questions,
          });
        } else if (action === 'assignment')
          id = await repo.saveAssignment(courseId, sectionId, itemId, draft);
        else if (action === 'order')
          id = await repo.order(courseId, sectionId, itemId, draft);
        else if (action === 'delete') {
          parseInput(deleteInput, draft);
          id = await repo.removeItem(courseId, sectionId, itemId);
        } else if (action === 'occurrences') {
          const { batchRef, ...body } = draft;
          if (
            typeof batchRef !== 'string' ||
            Object.hasOwn(body, 'courseId') ||
            Object.hasOwn(body, 'itemId')
          )
            throw new StudentError('INVALID_INPUT');
          // Context is server-derived; A1 revalidates Batch scope, Instructor assignment and history in its transaction.
          await repo.item(courseId, sectionId, itemId);
          const input = parseInput(sessionInput, {
            ...body,
            courseId,
            itemId,
            instructorId: body.instructorId
              ? adminId('instructor', String(body.instructorId))
              : null,
          });
          id = await new AdminOperations(db, actor.id).session(
            adminId('batch', batchRef),
            null,
            input,
          );
          return privateJson({ ref: adminHandle('session', id) });
        } else throw new StudentError('NOT_FOUND');
      } else throw new StudentError('NOT_FOUND');
      return privateJson({ ref: adminHandle(kind, id) });
    }),
  );
}
export { handler as GET, handler as POST };
