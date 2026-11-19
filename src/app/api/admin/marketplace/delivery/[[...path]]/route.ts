import { z } from 'zod';
import { requireAdminActor } from '@/lib/admin/session';
import { MarketplaceDeliveryService } from '@/lib/marketplace/delivery/service';
import { commerceResponse } from '@/lib/marketplace/commerce/http';
import { getDatabase } from '@/lib/db/client';
import { privateJson, requestBody } from '@/lib/student/http';
import { mutationLimiter } from '@/lib/student/abuse';
import { StudentError } from '@/lib/student/errors';
export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return commerceResponse(async () => {
    const actor = await requireAdminActor(),
      path = (await params).path || [];
    if (path.length !== 2 || path[1] !== 'retry')
      throw new StudentError('NOT_FOUND');
    if (
      !z
        .object({})
        .strict()
        .safeParse(await requestBody(request)).success
    )
      throw new StudentError('INVALID_INPUT');
    await mutationLimiter.check(actor.id, 'commerce-payment');
    await new MarketplaceDeliveryService(getDatabase()).run(
      path[0],
      { adminActorId: actor.id },
      true,
    );
    return privateJson({ checked: true });
  });
}
