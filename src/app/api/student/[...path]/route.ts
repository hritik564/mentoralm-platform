import { withRequestContext } from '@/lib/production/request-context';
import { mutationLimiter } from '@/lib/student/abuse';
import { getCurrentStudent } from '@/lib/student/session';
import { studentRepository } from '@/lib/student/session';
import { privateJson, requestBody, studentResponse } from '@/lib/student/http';
import { StudentError } from '@/lib/student/errors';
import {
  getStudentCourses,
  getResources,
  getReferral,
  ticketView,
} from '@/lib/student/services';
import { readResourceFile, validatePreviewContent } from '@/lib/student/files';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function route(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return withRequestContext(request, () =>
    studentResponse(async () => {
      const repo = await studentRepository();
      const { path } = await context.params;
      if (
        new URL(request.url).search ||
        path.some((part) => !/^[a-zA-Z0-9_-]{1,100}$/.test(part))
      )
        throw new StudentError('INVALID_INPUT');
      const key = path.join('/');
      if (request.method !== 'GET')
        await mutationLimiter.check(
          (await getCurrentStudent()).id,
          path[0] === 'tickets'
            ? 'support'
            : path[0] === 'referral'
              ? 'referral'
              : 'learning',
        );
      if (request.method === 'GET') {
        if (key === 'profile') return privateJson(await repo.profile());
        if (key === 'courses') return privateJson(await getStudentCourses());
        if (key === 'resources') return privateJson(await getResources());
        if (key === 'tickets')
          return privateJson((await repo.tickets()).map(ticketView));
        if (key === 'referral') return privateJson(await getReferral());
        if (path[0] === 'tickets' && path.length === 2)
          return privateJson(ticketView(await repo.ticket(path[1])));
        if (
          path[0] === 'resources' &&
          path.length === 3 &&
          ['preview', 'download'].includes(path[2])
        ) {
          const record = await repo.resource(path[1]);
          const preview = path[2] === 'preview';
          if (
            preview &&
            ![
              'application/pdf',
              'image/png',
              'image/jpeg',
              'image/webp',
              'image/gif',
              'text/plain',
            ].includes(record.mimeType)
          )
            throw new StudentError('NOT_FOUND');
          const content = await readResourceFile(record.storageKey);
          if (preview) validatePreviewContent(content, record.mimeType);
          const name =
            record.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) ||
            'resource';
          return new Response(new Uint8Array(content), {
            headers: {
              'Content-Type': preview
                ? record.mimeType
                : 'application/octet-stream',
              'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename="${name}"`,
              'Content-Length': String(content.length),
              'Cache-Control': 'private, no-store',
              'X-Content-Type-Options': 'nosniff',
              'Content-Security-Policy': "sandbox; default-src 'none'",
              'Referrer-Policy': 'no-referrer',
            },
          });
        }
      }
      if (request.method === 'PATCH' && key === 'profile')
        return privateJson(
          await repo.updateProfile(await requestBody(request)),
        );
      if (request.method === 'POST') {
        const body = await requestBody(request);
        if (key === 'courses/view') {
          await repo.recordView(body);
          return privateJson({ saved: true });
        }
        if (key === 'tickets')
          return privateJson(await repo.createTicket(body), 201);
        if (path[0] === 'tickets' && path.length === 3 && path[2] === 'reply') {
          await repo.reply(path[1], body);
          return privateJson({ saved: true });
        }
        if (key === 'referral/attribute') {
          await repo.attributeReferral(body);
          return privateJson({ saved: true });
        }
      }
      throw new StudentError('NOT_FOUND');
    }),
  );
}
export const GET = route;
export const POST = route;
export const PATCH = route;
