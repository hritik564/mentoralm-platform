import 'server-only';
import { StudentError, errorStatus } from '../../student/errors';
import { logUnavailable } from '../../production/request-context';
import type { CommercePayments } from './payments';
export async function commerceResponse(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (e) {
    const code = e instanceof StudentError ? e.code : 'UNAVAILABLE';
    if (code === 'UNAVAILABLE') logUnavailable('STUDENT_API_UNAVAILABLE');
    return Response.json(
      {
        error:
          code === 'NOT_FOUND'
            ? 'This order is not available.'
            : code === 'INVALID_INPUT'
              ? 'Check the submitted details.'
              : code === 'FORBIDDEN'
                ? 'This payment request could not be verified.'
                : code === 'UNAUTHENTICATED'
                  ? 'Sign in to continue.'
                  : code === 'RATE_LIMITED'
                    ? 'Please wait a moment before trying again.'
                    : code === 'CONFLICT'
                      ? 'This purchase changed or needs review. Check its current status before continuing.'
                      : 'Payment status is temporarily unavailable. Verify its status or contact Support.',
      },
      {
        status: errorStatus[code],
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  }
}
export async function paymentWebhook(
  request: Request,
  payments: Pick<CommercePayments, 'consumeWebhook'>,
) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new StudentError('INVALID_INPUT');
  const reader = request.body?.getReader();
  if (!reader) throw new StudentError('INVALID_INPUT');
  const parts: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 65536) {
      await reader.cancel();
      throw new StudentError('INVALID_INPUT');
    }
    parts.push(value);
  }
  await payments.consumeWebhook(Buffer.concat(parts), request.headers);
  return Response.json(
    { received: true },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
