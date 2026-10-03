import { withRequestContext } from '@/lib/production/request-context';
import { requireAdminActor } from '@/lib/admin/session';
import { GovernanceRepository } from '@/lib/admin/governance/read';
import { clerkDirectory } from '@/lib/admin/directory';
import { adminId } from '@/lib/admin/handles';
import { getDatabase } from '@/lib/db/client';
import { privateJson, requestBody } from '@/lib/student/http';
import { adminResponse } from '@/lib/admin/http';
import { StudentError } from '@/lib/student/errors';
import { mutationLimiter } from '@/lib/student/abuse';
export const dynamic = 'force-dynamic';
async function route(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return withRequestContext(request, () =>
    adminResponse(async () => {
      const actor = await requireAdminActor(),
        repo = new GovernanceRepository(
          getDatabase(),
          actor.id,
          clerkDirectory,
        ),
        { path } = await params;
      const [area, ref, action] = path,
        q = Object.fromEntries(new URL(request.url).searchParams);
      const allowed =
        area === 'audit'
          ? ['page', 'from', 'to', 'category', 'target', 'action', 'actor']
          : ['page', 'q', 'persona', 'role'];
      if (
        Object.keys(q).some((k) => !allowed.includes(k)) ||
        Object.values(q).some((v) => v.length > 500)
      )
        throw new StudentError('INVALID_INPUT');
      if (q.actor) q.actor = adminId('user', q.actor);
      if (request.method === 'GET') {
        if (path.length === 1) {
          if (area === 'users' || area === 'instructors')
            return privateJson(await repo.users(q, area === 'instructors'));
          if (area === 'audit') return privateJson(await repo.audit(q));
          if (area === 'settings') return privateJson(await repo.settings());
        }
        if (area === 'users' && path.length === 2)
          return privateJson(await repo.user(adminId('user', ref)));
        throw new StudentError('NOT_FOUND');
      }
      await mutationLimiter.check(actor.id, 'academic');
      const raw = await requestBody(request);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new StudentError('INVALID_INPUT');
      const body = raw as Record<string, unknown>;
      if (area === 'bulk' && ref === 'lms-access' && path.length === 2) {
        if (!Array.isArray(body.users) || body.users.length > 50)
          throw new StudentError('INVALID_INPUT');
        const users = body.users.map((v) => {
          if (typeof v !== 'string') throw new StudentError('INVALID_INPUT');
          return adminId('student', v);
        });
        return privateJson(await repo.bulk({ ...body, users }));
      }
      if (area !== 'users' || path.length !== 3)
        throw new StudentError('NOT_FOUND');
      const target = adminId('user', ref);
      if (action === 'roles') await repo.role(target, body);
      else if (action === 'policy') await repo.policy(target, body);
      else throw new StudentError('NOT_FOUND');
      return privateJson({ saved: true });
    }),
  );
}
export { route as GET, route as POST };
