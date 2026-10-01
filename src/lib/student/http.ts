import 'server-only';
import { StudentError, errorMessages, errorStatus } from './errors';
export async function requestBody(request: Request): Promise<unknown> {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    throw new StudentError('FORBIDDEN');
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
    if (code === 'UNAVAILABLE') console.error('student_api_unavailable');
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
