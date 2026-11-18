import 'server-only';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { marketplaceImages } from './types';

/** Finite existing public assets only; no upload, remote URL or filesystem input. */
export async function safeMarketplaceImage(
  value: string | null,
): Promise<string | null> {
  if (!value || !marketplaceImages.some((image) => image === value))
    return null;
  const filePath = path.join(process.cwd(), 'public', value.slice(1));
  try {
    // Keep every directory statically scoped so production tracing includes
    // only the existing public assets. All allowlisted files live here.
    const directories = await Promise.all([
      lstat(path.join(process.cwd(), 'public')),
      lstat(path.join(process.cwd(), 'public', 'images')),
      lstat(path.join(process.cwd(), 'public', 'images', 'homepage')),
      lstat(path.join(process.cwd(), 'public', 'brand')),
    ]);
    if (
      directories.some(
        (entry) => !entry.isDirectory() || entry.isSymbolicLink(),
      )
    )
      return null;
    const file = await open(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size < 12) return null;
      const header = Buffer.alloc(12);
      await file.read(header, 0, header.length, 0);
      const webp =
        header.toString('ascii', 0, 4) === 'RIFF' &&
        header.toString('ascii', 8, 12) === 'WEBP';
      const jpeg =
        header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      return (value.endsWith('.webp') ? webp : jpeg) ? value : null;
    } finally {
      await file.close();
    }
  } catch {
    return null;
  }
}
