import 'server-only';
import { Prisma } from '../../../generated/prisma/client';
import { StudentError } from '../../student/errors';
export function listParams(q: Record<string, string | undefined> = {}) {
  const page = Number(q.page || 1),
    search = (q.q || '').trim();
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000 ||
    search.length > 100
  )
    throw new StudentError('INVALID_INPUT');
  return { page, search, skip: (page - 1) * 20 };
}
export function dates(q: Record<string, string | undefined>) {
  for (const x of [q.from, q.to])
    if (
      x &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(x) ||
        Number.isNaN(Date.parse(x)) ||
        new Date(x).toISOString().slice(0, 10) !== x)
    )
      throw new StudentError('INVALID_INPUT');
  if (q.from && q.to && q.from > q.to) throw new StudentError('INVALID_INPUT');
  return {
    ...(q.from ? { gte: new Date(q.from) } : {}),
    ...(q.to ? { lt: new Date(Date.parse(q.to) + 86400000) } : {}),
  };
}
export function latestSubmissions(
  schema: string,
  q: Record<string, string | undefined>,
) {
  if (!/^(public|d4_[a-f0-9]{24})$/.test(schema))
    throw new StudentError('UNAVAILABLE');
  const p = listParams(q);
  const table = (name: string) => Prisma.raw(`"${schema}"."${name}"`);
  return Prisma.sql`FROM ${table('AssignmentSubmission')} s JOIN ${table('LearningItem')} i ON i.id=s."assignmentId" JOIN ${table('Section')} sec ON sec.id=i."sectionId" JOIN LATERAL (SELECT v.status,v."submittedAt" FROM ${table('SubmissionVersion')} v WHERE v."submissionId"=s.id ORDER BY v.number DESC LIMIT 1) latest ON true WHERE i.title ILIKE ${'%' + p.search + '%'} AND (${q.course || null}::text IS NULL OR sec."courseId"=${q.course || null}) AND (${q.student || null}::text IS NULL OR s."userId"=${q.student || null}) AND (${q.item || null}::text IS NULL OR s."assignmentId"=${q.item || null}) AND (${q.status || null}::text IS NULL OR latest.status::text=${q.status || null})`;
}
