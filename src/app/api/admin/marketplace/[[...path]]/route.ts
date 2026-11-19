import { withRequestContext } from '@/lib/production/request-context';
import { requireAdminActor } from '@/lib/admin/session';
import { adminResponse } from '@/lib/admin/http';
import { adminHandle, adminId } from '@/lib/admin/handles';
import { getDatabase } from '@/lib/db/client';
import { AdminMarketplace } from '@/lib/marketplace/admin';
import { AdminMarketplacePages } from '@/lib/marketplace/admin-pages';
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
      const [ref, action, resource, sectionRef, sectionAction] = path;
      const query = Object.fromEntries(new URL(request.url).searchParams);
      if (request.method === 'GET') {
        if (path.length === 0) return privateJson(await repo.list(query));
        if (path.length === 1 && ref === 'courses')
          return privateJson(await repo.courses(query));
        if (path.length === 1)
          return privateJson(await repo.detail(adminId('offering', ref)));
        if (path.length === 2 && action === 'page')
          return privateJson(
            await new AdminMarketplacePages(getDatabase(), actor.id).detail(
              adminId('offering', ref),
            ),
          );
        throw new StudentError('NOT_FOUND');
      }
      if (request.method !== 'POST') throw new StudentError('NOT_FOUND');
      await mutationLimiter.check(actor.id, 'academic');
      if (action === 'page') {
        const target = adminId('offering', ref);
        const pages = new AdminMarketplacePages(getDatabase(), actor.id);
        const body = await requestBody(request, 65536);
        if (path.length === 3 && resource === 'publish')
          return privateJson(
            await withMarketplaceMutation(() =>
              pages.publishPage(target, body),
            ),
          );
        let pageMutation: () => ReturnType<AdminMarketplacePages['detail']>;
        if (path.length === 3 && resource === 'settings')
          pageMutation = () => pages.saveSettings(target, body);
        else if (path.length === 3 && resource === 'sections')
          pageMutation = () => pages.createSection(target, body);
        else if (path.length === 3 && resource === 'reorder')
          pageMutation = () => pages.reorderSections(target, body);
        else if (path.length === 4 && resource === 'sections') {
          const section = adminId('offering-section', sectionRef);
          pageMutation = () => pages.updateSection(target, section, body);
        } else if (
          path.length === 5 &&
          resource === 'sections' &&
          sectionAction === 'enabled'
        ) {
          const section = adminId('offering-section', sectionRef);
          pageMutation = () => pages.setSectionEnabled(target, section, body);
        } else throw new StudentError('NOT_FOUND');
        return privateJson(await pageMutation());
      }
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
