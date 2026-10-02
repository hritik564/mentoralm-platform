import 'server-only';
import { StudentError, errorMessages, errorStatus } from '../student/errors';
export async function adminResponse(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    const code = error instanceof StudentError ? error.code : 'UNAVAILABLE';
    if (code === 'UNAVAILABLE') console.error('admin_api_unavailable');
    return Response.json(
      {
        error:
          code === 'UNAVAILABLE'
            ? 'Admin data is temporarily unavailable. Please try again later.'
            : errorMessages[code],
      },
      {
        status: errorStatus[code],
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  }
}
