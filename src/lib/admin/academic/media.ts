import 'server-only';
import { realpath, open, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AcademicCore, itemContext } from './core';
import { StudentError } from '../../student/errors';
import { requireAdminPermission } from '../../auth/admin-policy';
import { validatePrivateContent } from '../../storage/private-files';
import { uploadTypes } from '../../storage/submissions';
import { lessonMimes } from '../../lms/content';
const types: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/plain': 'txt',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
const ownedKey =
  /^academic-[a-f0-9-]{36}\.(pdf|png|jpg|webp|gif|txt|mp4|webm)$/;
async function root() {
  if (!process.env.LMS_FILES_ROOT) throw new StudentError('UNAVAILABLE');
  const base = await realpath(process.env.LMS_FILES_ROOT);
  const rel = relative(resolve(process.cwd(), 'public'), base);
  if (!rel.startsWith('..')) throw new StudentError('UNAVAILABLE');
  return base;
}
export class AcademicMedia extends AcademicCore {
  async attach(
    courseId: string,
    sectionId: string,
    itemId: string,
    file: File,
  ) {
    await this.authorize();
    const i = await itemContext(this.db, courseId, sectionId, itemId);
    const lesson = await this.db.lesson.findUnique({ where: { itemId } });
    if (
      i.published ||
      !['LESSON', 'RESOURCE'].includes(i.type) ||
      (i.type === 'LESSON' &&
        (!lesson || !lessonMimes[lesson.format]?.includes(file.type)))
    )
      throw new StudentError('CONFLICT');
    if (i.type === 'RESOURCE' && !uploadTypes[file.type])
      throw new StudentError('INVALID_INPUT');
    if (
      !types[file.type] ||
      file.size <= 0 ||
      file.size > (file.type.startsWith('video/') ? 50 : 25) * 1024 ** 2 ||
      file.name.length > 120 ||
      /[\\/]/.test(file.name) ||
      [...file.name].some((c) => c.charCodeAt(0) < 32)
    )
      throw new StudentError('INVALID_INPUT');
    const content = Buffer.from(await file.arrayBuffer());
    validatePrivateContent(content, file.type);
    if (
      file.type === 'text/plain' &&
      (content.includes(0) ||
        Buffer.from(content.toString('utf8')).compare(content) !== 0)
    )
      throw new StudentError('INVALID_INPUT');
    const base = await root(),
      storageKey = `academic-${randomUUID()}.${types[file.type]}`,
      fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Durable intent precedes filesystem creation so interrupted/unbound assets remain discoverable.
    await this.write('AcademicAssetUploadRequested', async (tx) => {
      await itemContext(tx, courseId, sectionId, itemId);
      return {
        value: itemId,
        targetId: itemId,
        details: { storageKey, mimeType: file.type, bytes: file.size },
      };
    });
    try {
      const handle = await open(
        join(base, storageKey),
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      try {
        await handle.writeFile(content);
      } finally {
        await handle.close();
      }
      const oldKey = await this.write('AcademicAssetAttached', async (tx) => {
        const current = await itemContext(tx, courseId, sectionId, itemId);
        if (current.published) throw new StudentError('CONFLICT');
        let previous: string | null;
        if (current.type === 'LESSON') {
          const l = await tx.lesson.findUnique({ where: { itemId } });
          if (!l || !lessonMimes[l.format]?.includes(file.type))
            throw new StudentError('CONFLICT');
          previous = l.storageKey;
          await tx.lesson.update({
            where: { itemId },
            data: { storageKey, fileName, mimeType: file.type },
          });
        } else if (current.type === 'RESOURCE') {
          const r = await tx.learningResource.findUnique({ where: { itemId } });
          previous = r?.storageKey || null;
          await tx.learningResource.upsert({
            where: { itemId },
            create: { itemId, storageKey, fileName, mimeType: file.type },
            update: { storageKey, fileName, mimeType: file.type },
          });
        } else throw new StudentError('CONFLICT');
        return {
          value: previous,
          targetId: itemId,
          details: {
            storageKey,
            previousKey: previous,
            fileName,
            mimeType: file.type,
            bytes: file.size,
            cleanupRequested: !!previous,
          },
        };
      });
      if (oldKey) await this.cleanup(oldKey, itemId);
      return { fileName, mimeType: file.type };
    } catch (error) {
      await this.cleanup(storageKey, itemId);
      throw error;
    }
  }
  async cleanup(key: string, targetId: string) {
    // Never delete legacy/shared assets or anything still referenced by the academic delivery models.
    await this.authorize();
    if (!ownedKey.test(key)) return false;
    const refs =
      (await this.db.lesson.count({
        where: { OR: [{ storageKey: key }, { captionsStorageKey: key }] },
      })) +
      (await this.db.learningResource.count({ where: { storageKey: key } }));
    if (refs) return false;
    try {
      await unlink(join(await root(), key));
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )) {
        await this.write('AcademicAssetCleanupPending', async () => ({
          value: null,
          targetId,
          details: { storageKey: key },
        }));
        return false;
      }
    }
    await this.write('AcademicAssetCleanupConfirmed', async () => ({
      value: null,
      targetId,
      details: { storageKey: key },
    }));
    return true;
  }
  /** Trusted operator repair for interrupted uploads/replacements. Run after stopping active authoring; no background provider invented. */
  async reconcile() {
    await requireAdminPermission(this.db, this.actorId, 'ACADEMICS_MANAGE');
    const rows = await this.db.academicAudit.findMany({
      where: {
        action: {
          in: [
            'AcademicAssetUploadRequested',
            'AcademicAssetAttached',
            'AcademicAssetCleanupPending',
          ],
        },
        createdAt: { lt: new Date(Date.now() - 3600000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    const keys = new Map<string, string>();
    for (const r of rows) {
      const d = r.details as {
        storageKey?: string;
        previousKey?: string;
      } | null;
      for (const key of [d?.storageKey, d?.previousKey])
        if (key && ownedKey.test(key)) keys.set(key, r.targetId);
    }
    const confirmed = await this.db.academicAudit.findMany({
      where: {
        action: 'AcademicAssetCleanupConfirmed',
        details: { path: ['storageKey'], string_starts_with: 'academic-' },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: { details: true },
    });
    for (const row of confirmed) {
      const key = (row.details as { storageKey?: string } | null)?.storageKey;
      if (key) keys.delete(key);
    }
    let cleaned = 0;
    for (const [key, targetId] of keys)
      if (await this.cleanup(key, targetId)) cleaned++;
    return { examined: keys.size, cleaned };
  }
}
