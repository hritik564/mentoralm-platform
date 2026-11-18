import { withRequestContext } from '@/lib/production/request-context';
import { requireAdminActor } from '@/lib/admin/session';
import { adminResponse } from '@/lib/admin/http';
import { adminHandle, adminId } from '@/lib/admin/handles';
import { getDatabase } from '@/lib/db/client';
import { AdminMarketplace } from '@/lib/marketplace/admin';
import { withMarketplaceMutation } from '@/lib/marketplace/mutation';
import { mutationLimiter } from '@/lib/student/abuse';
import { privateJson, requestBody } from '@/lib/student/http';
import { StudentError } from '@/lib/student/errors';

export const dynamic = 'force-dynamic';
async function route(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return withRequestContext(request, () =>
    adminResponse(async () => {
      const actor = await requireAdminActor();
      const repo = new AdminMarketplace(getDatabase(), actor.id);
      await repo.authorize();
      const { path = [] } = await params;
      const [ref, action] = path;
      const query = Object.fromEntries(new URL(request.url).searchParams);
      if (request.method === 'GET') {
        if (path.length === 0) return privateJson(await repo.list(query));
        if (path.length === 1 && ref === 'courses')
          return privateJson(await repo.courses(query));
        if (path.length === 1)
          return privateJson(await repo.detail(adminId('offering', ref)));
        throw new StudentError('NOT_FOUND');
      }
      if (request.method !== 'POST') throw new StudentError('NOT_FOUND');
      await mutationLimiter.check(actor.id, 'academic');
      const body = await requestBody(request);
      let mutate: () => Promise<string>;
      if (path.length === 0) mutate = () => repo.save(null, body);
      else if (path.length === 1) {
        const target = adminId('offering', ref);
        mutate = () => repo.save(target, body);
      } else if (
        path.length === 2 &&
        ['publish', 'unpublish', 'archive'].includes(action)
      ) {
        const target = adminId('offering', ref);
        mutate = () =>
          action === 'publish'
            ? repo.publish(target, body)
            : action === 'unpublish'
              ? repo.unpublish(target, body)
              : repo.archive(target, body);
      } else throw new StudentError('NOT_FOUND');
      const id = await withMarketplaceMutation(mutate);
      return privateJson({ ref: adminHandle('offering', id) });
    }),
  );
}
export { route as GET, route as POST };
