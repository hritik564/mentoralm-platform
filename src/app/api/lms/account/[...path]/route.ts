import { withRequestContext } from '@/lib/production/request-context';
import { GET as sharedStudentRoute } from '@/app/api/student/[...path]/route';
import { getLmsRepository } from '@/lib/lms/services';
import { studentResponse } from '@/lib/student/http';
import { StudentError } from '@/lib/student/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function route(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return withRequestContext(request, () =>
    studentResponse(async () => {
      await getLmsRepository();
      const { path } = await context.params;
      const allowed =
        (path.length === 1 && ['profile', 'tickets'].includes(path[0])) ||
        (path[0] === 'tickets' &&
          (path.length === 2 || (path.length === 3 && path[2] === 'reply')));
      if (!allowed) throw new StudentError('NOT_FOUND');
      // Delegate unchanged validation, actor resolution, ownership and limiter policy.
      return sharedStudentRoute(request, context);
    }),
  );
}
export const GET = route;
export const POST = route;
export const PATCH = route;
