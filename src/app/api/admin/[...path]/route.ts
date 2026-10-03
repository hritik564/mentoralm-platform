import { requireAdminActor } from '@/lib/admin/session';
import { AdminRepository } from '@/lib/admin/repository';
import { clerkDirectory } from '@/lib/admin/directory';
import { AdminRecordings } from '@/lib/admin/recordings';
import { adminHandle, adminId, type HandleKind } from '@/lib/admin/handles';
import { getDatabase } from '@/lib/db/client';
import { privateJson, requestBody } from '@/lib/student/http';
import { adminResponse } from '@/lib/admin/http';
import { StudentError } from '@/lib/student/errors';
import { mutationLimiter } from '@/lib/student/abuse';
export const dynamic = 'force-dynamic';
async function handler(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return adminResponse(async () => {
    const actor = await requireAdminActor(),
      db = getDatabase(),
      repo = new AdminRepository(db, actor.id, clerkDirectory);
    const { path } = await params,
      [area, ref, action] = path;
    const q = Object.fromEntries(new URL(request.url).searchParams);
    if (request.method === 'GET') {
      if (path.length === 1 && area === 'overview')
        return privateJson(await repo.overview());
      if (path.length === 1 && area === 'students')
        return privateJson(await repo.students(q));
      if (path.length === 2 && area === 'students')
        return privateJson(await repo.student(adminId('student', ref)));
      if (path.length === 1 && area === 'batches')
        return privateJson(await repo.batches(q));
      if (path.length === 2 && area === 'batches')
        return privateJson(await repo.batch(adminId('batch', ref), q));
      if (
        area === 'choices' &&
        path.length === 2 &&
        ['courses', 'programs', 'instructors', 'items', 'batches'].includes(ref)
      )
        return privateJson(
          await repo.choices(
            ref as 'courses',
            ref === 'items' ? adminId('course', q.course || '') : q.q,
          ),
        );
      throw new StudentError('NOT_FOUND');
    }
    if (request.method !== 'POST') throw new StudentError('NOT_FOUND');
    mutationLimiter.check(actor.id, 'academic');
    const body = await requestBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new StudentError('INVALID_INPUT');
    const draft = body as Record<string, unknown>;
    function map(value: unknown, kind: HandleKind) {
      return value === null
        ? null
        : typeof value === 'string'
          ? adminId(kind, value)
          : value;
    }
    if (area === 'students' && path.length === 3) {
      const id = adminId('student', ref);
      if (action === 'access') await repo.override(id, draft);
      else if (action === 'enrollments')
        await repo.enrollment(id, {
          ...draft,
          courseId: map(draft.courseId, 'course'),
        });
      else throw new StudentError('NOT_FOUND');
      return privateJson({ saved: true });
    }
    if (area === 'batches') {
      if (path.length === 1 || path.length === 2) {
        const id = await repo.saveBatch(ref ? adminId('batch', ref) : null, {
          ...draft,
          courseId: map(draft.courseId, 'course'),
          programId: map(draft.programId, 'program'),
        });
        return privateJson({ ref: adminHandle('batch', id) });
      }
      const id = adminId('batch', ref);
      if (path.length === 3 && action === 'memberships')
        await repo.membership(id, {
          ...draft,
          userId: map(draft.userId, 'student'),
        });
      else if (path.length === 3 && action === 'instructors')
        await repo.instructor(id, {
          ...draft,
          instructorId: map(draft.instructorId, 'instructor'),
        });
      else if (path.length === 3 && action === 'sessions') {
        const sessionId = await repo.session(id, null, {
          ...draft,
          courseId: map(draft.courseId, 'course'),
          itemId: map(draft.itemId, 'item'),
          instructorId: map(draft.instructorId, 'instructor'),
        });
        return privateJson({ ref: adminHandle('session', sessionId) });
      } else if (path.length === 4 && action === 'sessions') {
        await repo.session(id, adminId('session', path[3]), {
          ...draft,
          courseId: map(draft.courseId, 'course'),
          itemId: map(draft.itemId, 'item'),
          instructorId: map(draft.instructorId, 'instructor'),
        });
      } else if (path.length === 3 && action === 'access') {
        if (Object.keys(draft).length !== 1 || typeof draft.value !== 'boolean')
          throw new StudentError('INVALID_INPUT');
        await repo.batchAccess(id, draft.value);
      } else throw new StudentError('NOT_FOUND');
      return privateJson({ saved: true });
    }
    if (area === 'sessions' && path.length === 3 && action === 'recording') {
      await new AdminRecordings(db, actor.id).change(
        adminId('session', ref),
        draft,
      );
      return privateJson({ saved: true });
    }
    throw new StudentError('NOT_FOUND');
  });
}
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as DELETE,
  handler as PATCH,
};
