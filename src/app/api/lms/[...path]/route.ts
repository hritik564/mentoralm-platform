import { mutationLimiter } from '@/lib/student/abuse';
import { getCurrentStudent } from '@/lib/student/session';
import { z } from 'zod';
import { getLearningRepository } from '@/lib/lms/services';
import { privateFileResponse } from '@/lib/storage/private-files';
import { privateJson, requestBody, studentResponse } from '@/lib/student/http';
import { StudentError } from '@/lib/student/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function route(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return studentResponse(async () => {
    const repo = await getLearningRepository(),
      { path } = await context.params;
    if (path.some((part) => !/^[a-zA-Z0-9_-]{1,100}$/.test(part)))
      throw new StudentError('INVALID_INPUT');
    const url = new URL(request.url);
    if (
      [...url.searchParams].some(
        ([key, value]) => key !== 'download' || value !== '1',
      ) ||
      url.searchParams.getAll('download').length > 1
    )
      throw new StudentError('INVALID_INPUT');
    if (path[0] !== 'courses') throw new StudentError('NOT_FOUND');
    if (request.method !== 'GET')
      mutationLimiter.check((await getCurrentStudent()).id, 'learning');
    if (request.method === 'GET') {
      if (path.length === 2 && !url.search)
        return privateJson(await repo.course(path[1]));
      if (
        path.length === 5 &&
        path[2] === 'lessons' &&
        ['media', 'captions'].includes(path[4])
      )
        return privateFileResponse(
          request,
          await repo.media(path[1], path[3], path[4] === 'captions'),
          process.env.LMS_FILES_ROOT,
        );
      if (path.length === 5 && path[2] === 'resources' && path[4] === 'media')
        return privateFileResponse(
          request,
          await repo.resourceMedia(path[1], path[3]),
          process.env.LMS_FILES_ROOT,
        );
    }
    if (
      request.method === 'POST' &&
      !url.search &&
      path.length === 5 &&
      path[2] === 'lessons' &&
      ['access', 'complete'].includes(path[4])
    ) {
      if (
        !z
          .object({})
          .strict()
          .safeParse(await requestBody(request)).success
      )
        throw new StudentError('INVALID_INPUT');
      await repo.record(path[1], path[3], path[4] === 'complete');
      return privateJson({ saved: true });
    }
    throw new StudentError('NOT_FOUND');
  });
}
export const GET = route;
export const POST = route;
