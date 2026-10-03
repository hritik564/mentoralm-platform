import { withRequestContext } from '@/lib/production/request-context';
import { mutationLimiter } from '@/lib/student/abuse';
import { getCurrentStudent } from '@/lib/student/session';
import { getAcademics } from '@/lib/lms/services';
import { privateJson, requestBody, studentResponse } from '@/lib/student/http';
import { privateFileResponse } from '@/lib/storage/private-files';
import { multipartBody } from '@/lib/storage/submissions';
import { StudentError } from '@/lib/student/errors';
import { z } from 'zod';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function route(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return withRequestContext(request, () =>
    studentResponse(async () => {
      const repo = await getAcademics(),
        { path } = await context.params,
        url = new URL(request.url);
      if (
        path.some((p) => !/^[a-zA-Z0-9_-]{1,100}$/.test(p)) ||
        (url.search && url.search !== '?download=1')
      )
        throw new StudentError('INVALID_INPUT');
      if (request.method !== 'GET')
        await mutationLimiter.check(
          (await getCurrentStudent()).id,
          path.includes('assignments') ? 'upload' : 'academic',
        );
      if (request.method === 'GET') {
        if (path[0] === 'certificates' && path.length === 2 && !url.search)
          return privateJson(await repo.certificate(path[1]));
        if (
          path[0] === 'certificates' &&
          path.length === 3 &&
          ['media', 'preview', 'download'].includes(path[2])
        )
          return privateFileResponse(
            path[2] === 'download'
              ? new Request(new URL('?download=1', request.url), {
                  headers: request.headers,
                })
              : request,
            await repo.certificateFile(path[1]),
            process.env.LMS_FILES_ROOT,
          );
        if (path[0] === 'attendance' && path.length === 1 && !url.search)
          return privateJson(await repo.attendance());
        if (path[0] === 'assignments' && path.length === 1 && !url.search)
          return privateJson(await repo.assignments.list());
        if (
          path[0] === 'courses' &&
          path.length === 6 &&
          path[2] === 'assignments' &&
          path[4] === 'files'
        )
          return privateFileResponse(
            request,
            await repo.assignments.file(path[1], path[3], path[5]),
            process.env.LMS_SUBMISSIONS_ROOT,
          );
        if (
          path[0] === 'courses' &&
          path.length === 4 &&
          path[2] === 'activities' &&
          !url.search
        )
          return privateJson(await repo.attempts.view(path[1], path[3]));
      }
      if (request.method === 'POST' && !url.search && path[0] === 'courses') {
        if (
          path.length === 5 &&
          path[2] === 'activities' &&
          path[4] === 'start'
        ) {
          if (
            !z
              .object({})
              .strict()
              .safeParse(await requestBody(request)).success
          )
            throw new StudentError('INVALID_INPUT');
          return privateJson(await repo.attempts.start(path[1], path[3]));
        }
        if (
          path.length === 7 &&
          path[2] === 'activities' &&
          path[4] === 'attempts'
        ) {
          const body = await requestBody(request);
          if (path[6] === 'save')
            return privateJson(
              await repo.attempts.save(path[1], path[3], path[5], body),
            );
          if (
            path[6] === 'submit' &&
            z.object({}).strict().safeParse(body).success
          )
            return privateJson(
              await repo.attempts.submit(path[1], path[3], path[5]),
            );
        }
        if (
          path.length === 5 &&
          path[2] === 'assignments' &&
          path[4] === 'submit'
        ) {
          if (
            request.headers.get('content-type')?.startsWith('application/json')
          )
            return privateJson(
              await repo.assignments.submit(
                path[1],
                path[3],
                await requestBody(request),
              ),
            );
          const form = await multipartBody(request);
          if (
            [...form.keys()].some((k) => !['payload', 'files'].includes(k)) ||
            form.getAll('payload').length !== 1 ||
            typeof form.get('payload') !== 'string' ||
            form.getAll('files').some((f) => !(f instanceof File))
          )
            throw new StudentError('INVALID_INPUT');
          let input: unknown;
          try {
            input = JSON.parse(form.get('payload') as string);
          } catch {
            throw new StudentError('INVALID_INPUT');
          }
          return privateJson(
            await repo.assignments.submit(
              path[1],
              path[3],
              input,
              form.getAll('files') as File[],
            ),
          );
        }
      }
      throw new StudentError('NOT_FOUND');
    }),
  );
}
export const GET = route;
export const POST = route;
