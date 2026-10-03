import 'server-only';
import { requireAdminPermission } from '../auth/admin-policy';
import type { PrismaClient, Prisma } from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { academicTransaction } from '../lms/completion';
import { courseAccessWhere } from '../lms/learning';
import { recordingInput, parseInput } from './validation';
/** Adapter must use revision-idempotent creation, private immutable assets and deletion that fences late creation. */
export interface RecordingStore {
  readonly name: string;
  begin: (revision: string) => Promise<{ assetRef: string }>;
  inspect: (
    revision: string,
    assetRef: string | null,
  ) => Promise<{
    ready: boolean;
    failed?: boolean;
    assetRef: string;
    fileName?: string;
    mimeType?: string;
    bytes?: bigint;
    durationSeconds?: number;
  }>;
  remove: (revision: string, assetRef: string | null) => Promise<void>;
  deliver: (assetRef: string, request: Request) => Promise<Response>;
}
function privateAssetRef(value: string) {
  if (
    !value.trim() ||
    value.length > 2000 ||
    /^[a-z][a-z0-9+.-]*:/i.test(value) ||
    /[?#\s]/.test(value)
  )
    throw new StudentError('INVALID_INPUT');
  return value;
}
/** No production provider is installed. A1 never substitutes a local large-video upload. */
export function configuredRecordingStore(): RecordingStore | null {
  return null;
}
export async function assertAdmin(
  db: Prisma.TransactionClient,
  userId: string,
) {
  await requireAdminPermission(db, userId, 'BATCHES_MANAGE');
}
export async function recordingContext(
  db: Prisma.TransactionClient,
  sessionId: string,
) {
  const session = await db.batchSession.findUnique({
    where: { id: sessionId },
    include: {
      batch: true,
      item: { include: { section: { include: { course: true } } } },
    },
  });
  if (!session) throw new StudentError('NOT_FOUND');
  const course = session.item?.section.course;
  if (
    !course ||
    session.item?.type !== 'LIVE_SESSION' ||
    (session.courseId && session.courseId !== course.id) ||
    (session.batch.courseId && session.batch.courseId !== course.id) ||
    (session.batch.programId && session.batch.programId !== course.programId) ||
    !course.published ||
    !session.item.published ||
    !session.item.section.published
  )
    throw new StudentError('CONFLICT');
  return { session, course };
}
export class AdminRecordings {
  constructor(
    private db: PrismaClient,
    private actorId: string,
    private store: RecordingStore | null = configuredRecordingStore(),
  ) {}
  async change(sessionId: string, input: unknown) {
    const command = parseInput(recordingInput, input);
    await assertAdmin(this.db, this.actorId);
    const old = await this.db.batchSessionRecording.findUnique({
      where: { sessionId },
    });
    if (command.action === 'UPLOAD') {
      if (!this.store) throw new StudentError('UNAVAILABLE');
      const record = await academicTransaction(this.db, async (tx) => {
        await assertAdmin(tx, this.actorId);
        await recordingContext(tx, sessionId);
        if (await tx.batchSessionRecording.findUnique({ where: { sessionId } }))
          throw new StudentError('CONFLICT');
        const record = await tx.batchSessionRecording.create({
          data: {
            sessionId,
            storageProvider: this.store!.name,
            title: command.title,
            description: command.description,
          },
        });
        await tx.academicAudit.create({
          data: {
            actorId: this.actorId,
            action: 'RecordingUploadRequested',
            targetId: sessionId,
            details: { revision: record.revision },
          },
        });
        return record;
      });
      // The durable row exists before external creation. Uncertain outcomes retain revision for reconciliation.
      const asset = await this.store.begin(record.revision);
      await academicTransaction(this.db, async (tx) => {
        await assertAdmin(tx, this.actorId);
        const bound = await tx.batchSessionRecording.updateMany({
          where: {
            sessionId,
            revision: record.revision,
            status: 'UPLOADING',
            cleanupRequestedAt: null,
          },
          data: { assetRef: privateAssetRef(asset.assetRef) },
        });
        if (bound.count !== 1) throw new StudentError('CONFLICT');
        await tx.academicAudit.create({
          data: {
            actorId: this.actorId,
            action: 'RecordingUploadBound',
            targetId: sessionId,
            details: { revision: record.revision },
          },
        });
      });
      return;
    }
    if (!old || old.revision !== command.revision)
      throw new StudentError('CONFLICT');
    if (['DELETE', 'REPLACE', 'RETRY_CLEANUP'].includes(command.action)) {
      if (!this.store || this.store.name !== old.storageProvider)
        throw new StudentError('UNAVAILABLE');
      await academicTransaction(this.db, async (tx) => {
        await assertAdmin(tx, this.actorId);
        const n = await tx.batchSessionRecording.updateMany({
          where: { sessionId, revision: old.revision },
          data: {
            status: old.readyAt ? 'READY' : 'FAILED',
            publishedAt: null,
            cleanupRequestedAt: new Date(),
          },
        });
        if (n.count !== 1) throw new StudentError('CONFLICT');
        await tx.academicAudit.create({
          data: {
            actorId: this.actorId,
            action: 'RecordingCleanupRequested',
            targetId: sessionId,
            details: {
              revision: old.revision,
              before: old.status,
              after: 'UNPUBLISHED',
            },
          },
        });
      });
      await this.store.remove(old.revision, old.assetRef);
      await academicTransaction(this.db, async (tx) => {
        await assertAdmin(tx, this.actorId);
        const n = await tx.batchSessionRecording.deleteMany({
          where: {
            sessionId,
            revision: old.revision,
            cleanupRequestedAt: { not: null },
          },
        });
        if (n.count !== 1) throw new StudentError('CONFLICT');
        await tx.academicAudit.create({
          data: {
            actorId: this.actorId,
            action: 'RecordingCleanupConfirmed',
            targetId: sessionId,
            details: { revision: old.revision },
          },
        });
      });
      // REPLACE intentionally requires a new explicit upload after cleanup; no automatic second asset.
      return;
    }
    let ready = false;
    if (command.action === 'PUBLISH') {
      if (!this.store || this.store.name !== old.storageProvider)
        throw new StudentError('UNAVAILABLE');
      const inspected = await this.store.inspect(old.revision, old.assetRef);
      ready =
        inspected.ready &&
        !inspected.failed &&
        inspected.assetRef === old.assetRef;
    }
    await academicTransaction(this.db, async (tx) => {
      await assertAdmin(tx, this.actorId);
      const record = await tx.batchSessionRecording.findUnique({
        where: { sessionId },
      });
      if (
        !record ||
        record.revision !== command.revision ||
        record.cleanupRequestedAt
      )
        throw new StudentError('CONFLICT');
      if (command.action === 'PUBLISH') {
        await recordingContext(tx, sessionId);
        if (record.status !== 'READY' || !record.readyAt || !ready)
          throw new StudentError('CONFLICT');
      }
      if (command.action === 'UNPUBLISH' && record.status !== 'PUBLISHED')
        throw new StudentError('CONFLICT');
      const data =
        command.action === 'METADATA'
          ? { title: command.title, description: command.description }
          : command.action === 'PUBLISH'
            ? { status: 'PUBLISHED' as const, publishedAt: new Date() }
            : { status: 'READY' as const, publishedAt: null };
      await tx.batchSessionRecording.update({ where: { sessionId }, data });
      await tx.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: `Recording${command.action}`,
          targetId: sessionId,
          details: {
            revision: record.revision,
            before: {
              status: record.status,
              title: record.title,
              descriptionChanged:
                command.description !== undefined &&
                command.description !== record.description,
            },
            after: {
              status:
                command.action === 'PUBLISH'
                  ? 'PUBLISHED'
                  : command.action === 'UNPUBLISH'
                    ? 'READY'
                    : record.status,
              title: command.title === undefined ? record.title : command.title,
            },
          },
        },
      });
    });
  }
  /** Trusted adapter callback boundary, never a client action. Caller must verify provider signature. */
  async reconcile(sessionId: string, revision: string) {
    await assertAdmin(this.db, this.actorId);
    if (!this.store) throw new StudentError('UNAVAILABLE');
    const r = await this.db.batchSessionRecording.findUnique({
      where: { sessionId },
    });
    if (
      !r ||
      r.revision !== revision ||
      r.cleanupRequestedAt ||
      r.storageProvider !== this.store.name ||
      !['UPLOADING', 'PROCESSING'].includes(r.status)
    )
      throw new StudentError('CONFLICT');
    const confirmed = await this.store.inspect(revision, r.assetRef);
    await academicTransaction(this.db, async (tx) => {
      await assertAdmin(tx, this.actorId);
      const n = await tx.batchSessionRecording.updateMany({
        where: {
          sessionId,
          revision,
          cleanupRequestedAt: null,
          status: { in: ['UPLOADING', 'PROCESSING'] },
        },
        data: {
          assetRef: privateAssetRef(confirmed.assetRef),
          status: confirmed.failed
            ? 'FAILED'
            : confirmed.ready
              ? 'READY'
              : 'PROCESSING',
          readyAt: confirmed.ready && !confirmed.failed ? new Date() : null,
          fileName: confirmed.fileName,
          mimeType: confirmed.mimeType,
          bytes: confirmed.bytes,
          durationSeconds: confirmed.durationSeconds,
        },
      });
      if (n.count !== 1) throw new StudentError('CONFLICT');
      await tx.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: 'RecordingStorageConfirmed',
          targetId: sessionId,
          details: {
            revision,
            after: confirmed.failed
              ? 'FAILED'
              : confirmed.ready
                ? 'READY'
                : 'PROCESSING',
          },
        },
      });
    });
  }
}
export async function authorizedRecording(
  db: PrismaClient,
  userId: string,
  courseId: string,
  itemId: string,
  sessionId: string,
) {
  const { session, course } = await recordingContext(db, sessionId);
  if (
    course.id !== courseId ||
    session.itemId !== itemId ||
    !(await db.course.findFirst({
      where: { id: courseId, ...courseAccessWhere(userId) },
      select: { id: true },
    }))
  )
    throw new StudentError('NOT_FOUND');
  const now = new Date();
  const membership = await db.batchMembership.findFirst({
    where: {
      userId,
      batchId: session.batchId,
      OR: [
        {
          joinedAt: { lte: session.startsAt },
          OR: [{ leftAt: null }, { leftAt: { gt: session.startsAt } }],
        },
        {
          status: 'ACTIVE',
          joinedAt: { lte: now },
          OR: [{ leftAt: null }, { leftAt: { gt: now } }],
        },
      ],
    },
    select: { id: true },
  });
  if (!membership) throw new StudentError('NOT_FOUND');
  const r = await db.batchSessionRecording.findFirst({
    where: {
      sessionId,
      status: 'PUBLISHED',
      readyAt: { not: null },
      cleanupRequestedAt: null,
    },
  });
  if (!r?.assetRef) throw new StudentError('NOT_FOUND');
  return r;
}
