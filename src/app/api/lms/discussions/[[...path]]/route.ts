import { getDiscussions } from '@/lib/lms/services';
import { getCurrentStudent } from '@/lib/student/session';
import { mutationLimiter } from '@/lib/student/abuse';
import { privateJson, requestBody, studentResponse } from '@/lib/student/http';
import { StudentError } from '@/lib/student/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function route(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  return studentResponse(async () => {
    const repo = await getDiscussions(),
      { path = [] } = await context.params,
      url = new URL(request.url);
    if (path.some((p) => !/^[a-zA-Z0-9_-]{1,100}$/.test(p)) || url.search)
      throw new StudentError('INVALID_INPUT');
    if (request.method === 'GET') {
      if (!path.length) return privateJson(await repo.workspace());
      if (path.length === 1) return privateJson(await repo.thread(path[0]));
    }
    if (request.method === 'POST') {
      mutationLimiter.check((await getCurrentStudent()).id, 'discussion');
      const body = await requestBody(request);
      if (!path.length) return privateJson(await repo.create(body), 201);
      if (path.length === 2 && path[1] === 'reply')
        return privateJson(await repo.reply(path[0], body), 201);
    }
    throw new StudentError('NOT_FOUND');
  });
}
export const GET = route;
export const POST = route;
