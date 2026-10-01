import 'server-only';
import { realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { StudentError } from './errors';
export async function readResourceFile(storageKey: string | null) {
  const root = process.env.RESOURCE_FILES_ROOT;
  if (!root || !storageKey) throw new StudentError('UNAVAILABLE');
  if (!/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(storageKey))
    throw new StudentError('NOT_FOUND');
  const base = await realpath(root);
  const file = await realpath(resolve(base, storageKey));
  const path = relative(base, file);
  if (isAbsolute(path) || path.startsWith('..'))
    throw new StudentError('NOT_FOUND');
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 25 * 1024 * 1024)
      throw new StudentError('UNAVAILABLE');
    const buffer = Buffer.alloc(stat.size);
    const { bytesRead } = await handle.read(buffer, 0, stat.size, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Header checks supplement MIME allowlisting; publication scanning belongs to the future Admin pipeline. */
export function validatePreviewContent(content: Buffer, mimeType: string) {
  const prefix = content.subarray(0, 12);
  const valid =
    mimeType === 'application/pdf'
      ? prefix.subarray(0, 5).toString() === '%PDF-'
      : mimeType === 'image/png'
        ? prefix
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mimeType === 'image/jpeg'
          ? prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255
          : mimeType === 'image/webp'
            ? prefix.subarray(0, 4).toString() === 'RIFF' &&
              prefix.subarray(8, 12).toString() === 'WEBP'
            : mimeType === 'image/gif'
              ? ['GIF87a', 'GIF89a'].includes(prefix.subarray(0, 6).toString())
              : mimeType === 'text/plain';
  if (!valid) throw new StudentError('NOT_FOUND');
}
