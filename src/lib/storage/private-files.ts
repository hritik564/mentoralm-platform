import 'server-only';
import { realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { Readable } from 'node:stream';
import { StudentError } from '../student/errors';
export async function openPrivateFile(
  root: string | undefined,
  key: string | null,
  limit: number,
) {
  if (!root || !key) throw new StudentError('UNAVAILABLE');
  if (!/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(key))
    throw new StudentError('NOT_FOUND');
  try {
    const base = await realpath(root),
      file = await realpath(resolve(base, key));
    const path = relative(base, file);
    if (isAbsolute(path) || path.startsWith('..'))
      throw new StudentError('NOT_FOUND');
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size < 0 || stat.size > limit)
        throw new StudentError('UNAVAILABLE');
      return { handle, size: stat.size };
    } catch (error) {
      await handle.close();
      throw error;
    }
  } catch (error) {
    if (error instanceof StudentError) throw error;
    throw new StudentError('UNAVAILABLE');
  }
}
export function validatePrivateContent(content: Buffer, mime: string) {
  const p = content.subarray(0, 16);
  const valid =
    mime === 'application/pdf'
      ? p.subarray(0, 5).toString() === '%PDF-'
      : mime === 'image/png'
        ? p
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === 'image/jpeg'
          ? p[0] === 255 && p[1] === 216 && p[2] === 255
          : mime === 'image/webp'
            ? p.subarray(0, 4).toString() === 'RIFF' &&
              p.subarray(8, 12).toString() === 'WEBP'
            : mime === 'image/gif'
              ? ['GIF87a', 'GIF89a'].includes(p.subarray(0, 6).toString())
              : mime === 'video/mp4'
                ? p.subarray(4, 8).toString() === 'ftyp'
                : mime === 'video/webm'
                  ? p.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
                  : mime === 'text/vtt'
                    ? p.subarray(0, 6).toString() === 'WEBVTT'
                    : mime === 'text/plain';
  if (!valid) throw new StudentError('NOT_FOUND');
}
export async function privateFileResponse(
  request: Request,
  record: {
    storageKey: string | null;
    mimeType: string;
    fileName: string;
    downloadAllowed: boolean;
  },
  root: string | undefined,
) {
  const download = new URL(request.url).searchParams.get('download') === '1';
  if (download && !record.downloadAllowed) throw new StudentError('FORBIDDEN');
  const { handle, size } = await openPrivateFile(
    root,
    record.storageKey,
    record.mimeType.startsWith('video/') ? 2 * 1024 ** 3 : 25 * 1024 ** 2,
  );
  try {
    if (size === 0) throw new StudentError('UNAVAILABLE');
    const header = Buffer.alloc(16);
    await handle.read(header, 0, 16, 0);
    validatePrivateContent(header, record.mimeType);
    let start = 0,
      end = size - 1;
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        await handle.close();
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${size}`,
            'Cache-Control': 'private, no-store',
          },
        });
      }
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= size ||
        (!match[1] && Number(match[2]) === 0)
      ) {
        await handle.close();
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${size}`,
            'Cache-Control': 'private, no-store',
          },
        });
      }
    }
    const name =
      record.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) ||
      'lesson';
    const stream = handle.createReadStream({ start, end, autoClose: true });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': record.mimeType,
        'Content-Length': String(end - start + 1),
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'",
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    await handle.close();
    throw error;
  }
}
