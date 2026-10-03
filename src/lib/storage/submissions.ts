import 'server-only';
import { sameOrigin } from '../production/origin';
import { realpath, open, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { constants } from 'node:fs';
import { StudentError } from '../student/errors';
import { validatePrivateContent } from './private-files';
export const uploadTypes: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/plain': 'txt',
};
export interface SavedUpload {
  storageKey: string;
  fileName: string;
  mimeType: string;
  bytes: number;
}
export async function storeSubmissionFiles(
  files: File[],
  maxFiles: number,
  maxBytes: number,
): Promise<SavedUpload[]> {
  if (
    files.length > maxFiles ||
    files.some(
      (f) =>
        f.size <= 0 ||
        f.size > maxBytes ||
        !uploadTypes[f.type] ||
        f.name.length > 120 ||
        [...f.name].some((c) => c.charCodeAt(0) < 32) ||
        /[\\/]/.test(f.name),
    )
  )
    throw new StudentError('INVALID_INPUT');
  if (!files.length) return [];
  const root = process.env.LMS_SUBMISSIONS_ROOT;
  if (!root) throw new StudentError('UNAVAILABLE');
  const saved: SavedUpload[] = [];
  try {
    const base = await realpath(root);
    for (const file of files) {
      const content = Buffer.from(await file.arrayBuffer());
      validatePrivateContent(content, file.type);
      if (
        file.type === 'text/plain' &&
        (content.includes(0) ||
          Buffer.from(content.toString('utf8'), 'utf8').compare(content) !== 0)
      )
        throw new StudentError('INVALID_INPUT');
      const storageKey = `submission-${randomBytes(24).toString('hex')}.${uploadTypes[file.type]}`;
      const handle = await open(
        join(base, storageKey),
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      saved.push({
        storageKey,
        fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
        mimeType: file.type,
        bytes: content.length,
      });
      try {
        await handle.writeFile(content);
      } finally {
        await handle.close();
      }
    }
    return saved;
  } catch (error) {
    await removeSubmissionFiles(saved);
    if (error instanceof StudentError) throw error;
    throw new StudentError('UNAVAILABLE');
  }
}
export async function removeSubmissionFiles(files: SavedUpload[]) {
  if (!process.env.LMS_SUBMISSIONS_ROOT) return;
  const root = await realpath(process.env.LMS_SUBMISSIONS_ROOT);
  await Promise.all(
    files.map((f) =>
      /^submission-[a-f0-9]{48}\.[a-z]+$/.test(f.storageKey)
        ? unlink(join(root, f.storageKey)).catch(() => {})
        : Promise.resolve(),
    ),
  );
}
export async function multipartBody(request: Request) {
  if (
    !sameOrigin(request) ||
    !request.headers.get('content-type')?.startsWith('multipart/form-data;')
  )
    throw new StudentError('FORBIDDEN');
  const reader = request.body?.getReader();
  if (!reader) throw new StudentError('INVALID_INPUT');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 52 * 1024 ** 2) {
      await reader.cancel();
      throw new StudentError('INVALID_INPUT');
    }
    chunks.push(value);
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { 'Content-Type': request.headers.get('content-type')! },
    }).formData();
  } catch {
    throw new StudentError('INVALID_INPUT');
  }
}
