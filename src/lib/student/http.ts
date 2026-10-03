import 'server-only';
import { sameOrigin } from '../production/origin';
import { logUnavailable } from '../production/request-context';
import { StudentError, errorMessages, errorStatus } from './errors';
export async function requestBody(request: Request): Promise<unknown> {
  if (!sameOrigin(request)) throw new StudentError('FORBIDDEN');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new StudentError('INVALID_INPUT');
  const reader = request.body?.getReader();
  if (!reader) throw new StudentError('INVALID_INPUT');
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 16384) {
      await reader.cancel();
      throw new StudentError('INVALID_INPUT');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new StudentError('INVALID_INPUT');
  }
}
export async function studentResponse(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    const code = error instanceof StudentError ? error.code : 'UNAVAILABLE';
    if (code === 'UNAVAILABLE') logUnavailable('STUDENT_API_UNAVAILABLE');
    return Response.json(
      { error: errorMessages[code] },
      {
        status: errorStatus[code],
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  }
}
export function privateJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
