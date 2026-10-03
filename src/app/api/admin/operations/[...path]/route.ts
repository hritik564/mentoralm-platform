import { z } from 'zod';
import { requireAdminActor } from '@/lib/admin/session';
import {
  AdminOperationalRepository,
  type OperationalArea,
} from '@/lib/admin/operational/read';
import { clerkDirectory } from '@/lib/admin/directory';
import { adminId, adminHandle, type HandleKind } from '@/lib/admin/handles';
import { getDatabase } from '@/lib/db/client';
import { privateJson, requestBody } from '@/lib/student/http';
import { adminResponse } from '@/lib/admin/http';
import { StudentError } from '@/lib/student/errors';
import { mutationLimiter } from '@/lib/student/abuse';
import { privateFileResponse } from '@/lib/storage/private-files';
import { parseInput } from '@/lib/admin/validation';
import { id } from '@/lib/admin/operational/validation';
export const dynamic = 'force-dynamic';
const kinds: Record<OperationalArea, HandleKind> = {
  attendance: 'session',
  submissions: 'submission',
  attempts: 'attempt',
  certificates: 'certificate',
  discussions: 'thread',
  support: 'ticket',
  communications: 'message',
  referrals: 'student',
};
async function route(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return adminResponse(async () => {
    const actor = await requireAdminActor(),
      repo = new AdminOperationalRepository(
        getDatabase(),
        actor.id,
        clerkDirectory,
      );
    const { path } = await params,
      [area, ref, action, file] = path,
      q = Object.fromEntries(new URL(request.url).searchParams);
    for (const [key, kind] of [
      ['course', 'course'],
      ['batch', 'batch'],
      ['student', 'student'],
      ['item', 'item'],
    ] as const)
      if (q[key]) q[key] = adminId(kind, q[key]);
    if (request.method === 'GET') {
      if (path.length === 1 && area === 'overview')
        return privateJson(await repo.overview());
      if (!Object.hasOwn(kinds, area)) throw new StudentError('NOT_FOUND');
      if (path.length === 1)
        return privateJson(await repo.list(area as OperationalArea, q));
      const target = adminId(kinds[area as OperationalArea], ref);
      if (path.length === 4 && area === 'submissions' && action === 'files')
        return privateFileResponse(
          request,
          await repo.file(target, adminId('file', file)),
          process.env.LMS_SUBMISSIONS_ROOT,
        );
      if (path.length !== 2) throw new StudentError('NOT_FOUND');
      if (area === 'attendance')
        return privateJson(await repo.session(target, q));
      if (area === 'submissions')
        return privateJson(await repo.submission(target, q));
      if (area === 'attempts') return privateJson(await repo.attempt(target));
      if (area === 'certificates')
        return privateJson(await repo.certificateDetail(target));
      if (area === 'discussions')
        return privateJson(await repo.discussion(target, q));
      if (area === 'support') return privateJson(await repo.ticket(target, q));
      if (area === 'communications')
        return privateJson(await repo.message(target, q));
      return privateJson(await repo.referral(target, q));
    }
    if (request.method !== 'POST') throw new StudentError('NOT_FOUND');
    mutationLimiter.check(actor.id, 'academic');
    const raw = await requestBody(request);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new StudentError('INVALID_INPUT');
    const input = raw as Record<string, unknown>;
    const map = (value: unknown, kind: HandleKind) =>
      typeof value === 'string' ? adminId(kind, value) : value;
    if (
      area === 'communications' &&
      path.length === 2 &&
      ['audience', 'plan'].includes(ref)
    ) {
      const body = { ...input, batchId: map(input.batchId, 'batch') };
      if (ref === 'audience') return privateJson(await repo.audience(body));
      const saved = await repo.plan(body);
      return privateJson({ ref: adminHandle('message', saved.id) });
    }
    if (area === 'certificates' && path.length === 2 && ref === 'issue') {
      const c = parseInput(z.object({ userId: id, courseId: id }).strict(), {
        ...input,
        userId: map(input.userId, 'student'),
        courseId: map(input.courseId, 'course'),
      });
      const saved = await repo.issue(c.userId, c.courseId);
      return privateJson({ ref: adminHandle('certificate', saved) });
    }
    if (path.length !== 3 || !Object.hasOwn(kinds, area))
      throw new StudentError('NOT_FOUND');
    const target = adminId(kinds[area as OperationalArea], ref);
    if (area === 'attendance' && action === 'save') {
      const rows = Array.isArray(input.rows)
        ? input.rows.map((row) => {
            if (!row || typeof row !== 'object' || Array.isArray(row))
              throw new StudentError('INVALID_INPUT');
            const r = row as Record<string, unknown>;
            return {
              ...r,
              membershipId: map(r.membershipId, 'membership'),
              userId: map(r.userId, 'student'),
            };
          })
        : input.rows;
      const result = await repo.attendance(target, { ...input, rows });
      return privateJson({
        results: result.map((r) => ({
          ...r,
          userId: adminHandle('student', r.userId),
        })),
      });
    }
    if (area === 'submissions' && action === 'review') {
      const body = {
        ...input,
        versionId: map(input.versionId, 'version'),
        userId: map(input.userId, 'student'),
        courseId: map(input.courseId, 'course'),
        itemId: map(input.itemId, 'item'),
      };
      if (typeof body.versionId !== 'string')
        throw new StudentError('INVALID_INPUT');
      // Verify exact submission parent before the service rechecks immutable Student/Course/item context.
      const versionId = body.versionId;
      const detail = await repo.submission(target);
      if (
        !detail.versions.some(
          (v) => v.ref === adminHandle('version', versionId),
        )
      )
        throw new StudentError('NOT_FOUND');
      await repo.assignment(body.versionId, body);
    } else if (area === 'attempts' && action === 'review')
      await repo.review(target, {
        ...input,
        responseId: map(input.responseId, 'response'),
        userId: map(input.userId, 'student'),
        courseId: map(input.courseId, 'course'),
        itemId: map(input.itemId, 'item'),
      });
    else if (area === 'certificates' && action === 'state')
      await repo.certificate(target, input);
    else if (area === 'discussions' && action === 'lock')
      await repo.moderate(target, input);
    else if (area === 'support' && action === 'reply') {
      mutationLimiter.check(actor.id, 'support');
      await repo.support(target, input);
    } else throw new StudentError('NOT_FOUND');
    return privateJson({ saved: true });
  });
}
export { route as GET, route as POST };
