import { z } from 'zod';
import { enrollmentActor } from '@/lib/marketplace/enrollment/server';
import {
  commerceOrders,
  commercePayments,
} from '@/lib/marketplace/commerce/server';
import { commerceResponse } from '@/lib/marketplace/commerce/http';
import { purchasePolicy } from '@/lib/marketplace/commerce/config';
import { privateJson, requestBody } from '@/lib/student/http';
import { mutationLimiter } from '@/lib/student/abuse';
import { StudentError } from '@/lib/student/errors';
import { getDatabase } from '@/lib/db/client';
import { withRequestContext } from '@/lib/production/request-context';
export const dynamic = 'force-dynamic';
async function route(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return withRequestContext(request, () =>
    commerceResponse(async () => {
      const path = (await params).path || [];
      if (
        request.method === 'GET' &&
        path.length === 2 &&
        path[0] === 'ownership'
      ) {
        const actor = await enrollmentActor(false);
        const owns = actor
          ? await getDatabase().marketplaceEntitlement.findFirst({
              where: {
                userId: actor.id,
                status: 'ACTIVE',
                offering: { slug: path[1] },
              },
              select: { id: true },
            })
          : null;
        return privateJson({ owned: !!owns });
      }
      const actor = await enrollmentActor();
      if (!actor) throw new StudentError('UNAUTHENTICATED');
      if (request.method === 'GET' && path.length === 2 && path[0] === 'orders')
        return privateJson(await commerceOrders().view(path[1], actor.id));
      if (request.method !== 'POST') throw new StudentError('NOT_FOUND');
      const body = await requestBody(request);
      await mutationLimiter.check(actor.id, 'commerce-payment');
      if (path.length === 1 && path[0] === 'orders')
        return privateJson(
          await commerceOrders().create(actor.id, body, purchasePolicy()),
        );
      if (path.length === 3 && path[0] === 'orders') {
        const [, , action] = path;
        if (action === 'return')
          return privateJson(
            await commercePayments().returnFromCheckout(
              path[1],
              actor.id,
              body,
            ),
          );
        if (!z.object({}).strict().safeParse(body).success)
          throw new StudentError('INVALID_INPUT');
        if (action === 'pay')
          return privateJson(await commercePayments().open(path[1], actor.id));
        if (action === 'reconcile')
          return privateJson(
            await commercePayments().reconcile(path[1], actor.id),
          );
      }
      throw new StudentError('NOT_FOUND');
    }),
  );
}
export { route as GET, route as POST };
