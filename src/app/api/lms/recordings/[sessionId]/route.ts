import { withRequestContext } from '@/lib/production/request-context';
import { getCurrentStudent } from '@/lib/student/session';
import { getDatabase } from '@/lib/db/client';
import { studentResponse } from '@/lib/student/http';
import { StudentError } from '@/lib/student/errors';
import {
  authorizedRecording,
  configuredRecordingStore,
} from '@/lib/admin/recordings';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  return withRequestContext(request, () =>
    studentResponse(async () => {
      const actor = await getCurrentStudent();
      if (actor.role !== 'STUDENT') throw new StudentError('FORBIDDEN');
      const { sessionId } = await params,
        url = new URL(request.url),
        course = url.searchParams.get('course') || '',
        item = url.searchParams.get('item') || '';
      if (
        ![sessionId, course, item].every((id) =>
          /^[a-zA-Z0-9_-]{1,100}$/.test(id),
        )
      )
        throw new StudentError('NOT_FOUND');
      const recording = await authorizedRecording(
          getDatabase(),
          actor.id,
          course,
          item,
          sessionId,
        ),
        store = configuredRecordingStore();
      if (!store || store.name !== recording.storageProvider)
        throw new StudentError('UNAVAILABLE');
      const delivered = await store.deliver(recording.assetRef!, request);
      const headers = new Headers(delivered.headers);
      headers.set('Cache-Control', 'private, no-store');
      headers.set('Vary', 'Cookie, Authorization');
      return new Response(delivered.body, {
        status: delivered.status,
        headers,
      });
    }),
  );
}
