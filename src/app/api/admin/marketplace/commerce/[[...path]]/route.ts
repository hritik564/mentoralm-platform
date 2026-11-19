import { clerkDirectory } from '@/lib/admin/directory';
import { z } from 'zod';
import { requireAdminActor } from '@/lib/admin/session';
import { CommerceAdmin } from '@/lib/marketplace/commerce/admin';
import { razorpayGateway } from '@/lib/marketplace/commerce/config';
import { commerceResponse } from '@/lib/marketplace/commerce/http';
import { getDatabase } from '@/lib/db/client';
import { privateJson, requestBody } from '@/lib/student/http';
import { mutationLimiter } from '@/lib/student/abuse';
import { StudentError } from '@/lib/student/errors';
import { withRequestContext } from '@/lib/production/request-context';
export const dynamic = 'force-dynamic';
async function route(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return withRequestContext(request, () =>
    commerceResponse(async () => {
      const actor = await requireAdminActor(),
        service = new CommerceAdmin(getDatabase(), actor.id, clerkDirectory),
        path = (await params).path || [];
      if (request.method === 'GET') {
        if (!path.length) {
          const page = Number(
            new URL(request.url).searchParams.get('page') || 1,
          );
          return privateJson(await service.list(page));
        }
        if (path.length === 1)
          return privateJson(await service.detail(path[0]));
      }
      if (
        request.method === 'POST' &&
        path.length === 2 &&
        path[1] === 'reconcile'
      ) {
        if (
          !z
            .object({})
            .strict()
            .safeParse(await requestBody(request)).success
        )
          throw new StudentError('INVALID_INPUT');
        await mutationLimiter.check(actor.id, 'commerce-payment');
        return privateJson(await service.reconcile(path[0], razorpayGateway()));
      }
      throw new StudentError('NOT_FOUND');
    }),
  );
}
export { route as GET, route as POST };
