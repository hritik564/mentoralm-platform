import 'server-only';
import {
  openPrivateFile,
  validatePrivateContent,
} from '../storage/private-files';
import { StudentError } from './errors';
export async function readResourceFile(storageKey: string | null) {
  const { handle, size } = await openPrivateFile(
    process.env.RESOURCE_FILES_ROOT,
    storageKey,
    25 * 1024 ** 2,
  );
  try {
    const content = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const { bytesRead } = await handle.read(
        content,
        offset,
        size - offset,
        offset,
      );
      if (!bytesRead) break;
      offset += bytesRead;
    }
    return content.subarray(0, offset);
  } finally {
    await handle.close();
  }
}
/** Dashboard preview policy remains narrower than shared LMS media support. */
export function validatePreviewContent(content: Buffer, mimeType: string) {
  if (
    ![
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'text/plain',
    ].includes(mimeType)
  )
    throw new StudentError('NOT_FOUND');
  validatePrivateContent(content, mimeType);
}
