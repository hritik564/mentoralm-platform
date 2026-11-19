import { enrollmentActor } from '@/lib/marketplace/enrollment/server';
import { myPrograms } from '@/lib/marketplace/delivery/read';
import { getDatabase } from '@/lib/db/client';
import { commerceResponse } from '@/lib/marketplace/commerce/http';
import { privateJson } from '@/lib/student/http';
import { StudentError } from '@/lib/student/errors';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return commerceResponse(async () => {
    const actor = await enrollmentActor();
    if (!actor) throw new StudentError('UNAUTHENTICATED');
    const path = (await params).path || [];
    if (path.length !== 1 || path[0] !== 'programs')
      throw new StudentError('NOT_FOUND');
    return privateJson(
      await myPrograms(
        getDatabase(),
        actor.id,
        Number(new URL(request.url).searchParams.get('page') || 1),
      ),
    );
  });
}
