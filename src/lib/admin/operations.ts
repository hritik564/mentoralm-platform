import 'server-only';
import type { PrismaClient } from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { academicTransaction } from '../lms/completion';
import { LmsAccessAdmin, applyLmsAccessChange } from '../lms/access-admin';
import {
  batchInput,
  sessionInput,
  membershipInput,
  instructorInput,
  overrideInput,
  enrollmentInput,
  parseInput,
} from './validation';
import { approvedExternalLink } from '../lms/content';
import { requireAdminPermission } from '../auth/admin-policy';
import type { AdminPermission } from '../../generated/prisma/client';
/** Mutations are separate from Admin read projections and reuse authoritative LMS rules. */
export class AdminOperations {
  constructor(
    protected db: PrismaClient,
    protected actorId: string,
  ) {}
  async authorize(permission: AdminPermission = 'BATCHES_MANAGE') {
    await requireAdminPermission(this.db, this.actorId, permission);
  }
  async override(id: string, input: unknown) {
    const c = parseInput(overrideInput, input);
    await this.authorize('STUDENTS_MANAGE');
    await new LmsAccessAdmin(this.db, this.actorId).change({
      kind: 'STUDENT_OVERRIDE',
      userId: id,
      value: c.value === 'INHERIT' ? null : c.value,
    });
  }
  async enrollment(id: string, input: unknown) {
    const c = parseInput(enrollmentInput, input);
    await this.authorize('STUDENTS_MANAGE');
    if (
      !(await this.db.course.findUnique({
        where: { id: c.courseId },
        select: { id: true },
      }))
    )
      throw new StudentError('NOT_FOUND');
    await new LmsAccessAdmin(this.db, this.actorId).change({
      kind: 'ENROLLMENT',
      userId: id,
      courseId: c.courseId,
      value: c.value,
    });
  }
  async saveBatch(id: string | null, input: unknown) {
    const c = parseInput(batchInput, input);
    return academicTransaction(this.db, async (tx) => {
      await requireAdminPermission(tx, this.actorId, 'BATCHES_MANAGE');
      if (
        c.courseId &&
        !(await tx.course.findUnique({
          where: { id: c.courseId },
          select: { id: true },
        }))
      )
        throw new StudentError('NOT_FOUND');
      if (
        c.programId &&
        !(await tx.program.findUnique({
          where: { id: c.programId },
          select: { id: true },
        }))
      )
        throw new StudentError('NOT_FOUND');
      if (c.courseId && c.programId) {
        const course = await tx.course.findUniqueOrThrow({
          where: { id: c.courseId },
        });
        if (course.programId !== c.programId)
          throw new StudentError('INVALID_INPUT');
      }
      const old = id ? await tx.batch.findUnique({ where: { id } }) : null;
      if (id && !old) throw new StudentError('NOT_FOUND');
      if (
        await tx.batch.findFirst({
          where: { code: c.code, ...(id ? { id: { not: id } } : {}) },
          select: { id: true },
        })
      )
        throw new StudentError('CONFLICT');
      if (
        old &&
        (old.courseId !== c.courseId || old.programId !== c.programId) &&
        (await tx.batchSession.count({
          where: { batchId: id!, recording: { is: { status: 'PUBLISHED' } } },
        }))
      )
        throw new StudentError('CONFLICT');
      const data = {
        ...c,
        lmsAccessEnabled: old?.lmsAccessEnabled || false,
        startsAt: c.startsAt ? new Date(c.startsAt) : null,
        endsAt: c.endsAt ? new Date(c.endsAt) : null,
      };
      const batch = id
        ? await tx.batch.update({ where: { id }, data })
        : await tx.batch.create({ data });
      if (c.lmsAccessEnabled !== batch.lmsAccessEnabled)
        await applyLmsAccessChange(tx, this.actorId, {
          kind: 'BATCH_ACCESS',
          batchId: batch.id,
          value: c.lmsAccessEnabled,
        });
      await tx.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: id ? 'BatchUpdated' : 'BatchCreated',
          targetId: batch.id,
          details: {
            before: old
              ? {
                  name: old.name,
                  status: old.status,
                  access: old.lmsAccessEnabled,
                }
              : null,
            after: {
              name: c.name,
              status: c.status,
              access: c.lmsAccessEnabled,
            },
          },
        },
      });
      return batch.id;
    });
  }
  async batchAccess(id: string, value: boolean) {
    await this.authorize();
    await new LmsAccessAdmin(this.db, this.actorId).change({
      kind: 'BATCH_ACCESS',
      batchId: id,
      value,
    });
  }
  async membership(batchId: string, input: unknown) {
    const c = parseInput(membershipInput, input);
    return academicTransaction(this.db, async (tx) => {
      await requireAdminPermission(tx, this.actorId, 'BATCHES_MANAGE');
      if (
        !(await tx.batch.findUnique({
          where: { id: batchId },
          select: { id: true },
        })) ||
        !(await tx.user.findFirst({
          where: { id: c.userId, role: 'STUDENT' },
          select: { id: true },
        }))
      )
        throw new StudentError('NOT_FOUND');
      const where = { userId_batchId: { userId: c.userId, batchId } },
        before = await tx.batchMembership.findUnique({ where });
      if (!before && c.status === 'INACTIVE')
        throw new StudentError('NOT_FOUND');
      const row = await tx.batchMembership.upsert({
        where,
        create: { batchId, userId: c.userId },
        update: {
          status: c.status,
          leftAt: c.status === 'INACTIVE' ? new Date() : null,
        },
      });
      await tx.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: 'BatchMembershipChanged',
          targetId: c.userId,
          details: {
            batchId,
            before: before
              ? {
                  status: before.status,
                  joinedAt: before.joinedAt.toISOString(),
                  leftAt: before.leftAt?.toISOString() || null,
                }
              : null,
            after: {
              status: row.status,
              joinedAt: row.joinedAt.toISOString(),
              leftAt: row.leftAt?.toISOString() || null,
            },
          },
        },
      });
    });
  }
  async instructor(batchId: string, input: unknown) {
    const c = parseInput(instructorInput, input);
    return academicTransaction(this.db, async (tx) => {
      await requireAdminPermission(tx, this.actorId, 'BATCHES_MANAGE');
      if (
        !(await tx.user.findFirst({
          where: { id: c.instructorId, role: 'INSTRUCTOR' },
          select: { id: true },
        })) ||
        !(await tx.batch.findUnique({
          where: { id: batchId },
          select: { id: true },
        }))
      )
        throw new StudentError('NOT_FOUND');
      const where = {
          batchId_instructorId: { batchId, instructorId: c.instructorId },
        },
        before = !!(await tx.batchInstructor.findUnique({ where }));
      if (c.assigned)
        await tx.batchInstructor.upsert({
          where,
          create: { batchId, instructorId: c.instructorId },
          update: {},
        });
      else
        await tx.batchInstructor.deleteMany({
          where: { batchId, instructorId: c.instructorId },
        });
      await tx.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: 'BatchInstructorChanged',
          targetId: batchId,
          details: { instructorId: c.instructorId, before, after: c.assigned },
        },
      });
    });
  }
  async session(batchId: string, id: string | null, input: unknown) {
    const c = parseInput(sessionInput, input);
    if (c.externalTargetId && !approvedExternalLink(c.externalTargetId))
      throw new StudentError('INVALID_INPUT');
    return academicTransaction(this.db, async (tx) => {
      await requireAdminPermission(tx, this.actorId, 'BATCHES_MANAGE');
      const batch = await tx.batch.findUnique({ where: { id: batchId } });
      if (!batch) throw new StudentError('NOT_FOUND');
      if (
        (batch.startsAt && new Date(c.startsAt) < batch.startsAt) ||
        (batch.endsAt && new Date(c.endsAt) > batch.endsAt)
      )
        throw new StudentError('INVALID_INPUT');
      if (
        c.instructorId &&
        (!(await tx.user.findFirst({
          where: { id: c.instructorId, role: 'INSTRUCTOR' },
          select: { id: true },
        })) ||
          !(await tx.batchInstructor.findUnique({
            where: {
              batchId_instructorId: { batchId, instructorId: c.instructorId },
            },
          })))
      )
        throw new StudentError('FORBIDDEN');
      const item = c.itemId
        ? await tx.learningItem.findUnique({
            where: { id: c.itemId },
            include: { section: { include: { course: true } } },
          })
        : null;
      const courseId = item?.section.courseId || c.courseId;
      if (
        c.itemId &&
        (!item ||
          item.type !== 'LIVE_SESSION' ||
          (c.courseId && c.courseId !== courseId))
      )
        throw new StudentError('INVALID_INPUT');
      const course = courseId
        ? await tx.course.findUnique({ where: { id: courseId } })
        : null;
      if (
        courseId &&
        (!course ||
          (batch.courseId && batch.courseId !== courseId) ||
          (batch.programId && batch.programId !== course.programId))
      )
        throw new StudentError('INVALID_INPUT');
      const before = id
        ? await tx.batchSession.findFirst({
            where: { id, batchId },
            include: { recording: true },
          })
        : null;
      if (id && !before) throw new StudentError('NOT_FOUND');
      if (
        before &&
        (before.recording?.status === 'PUBLISHED' ||
          (await tx.attendanceRecord.count({
            where: { sessionId: before.id },
          })) > 0) &&
        (before.itemId !== c.itemId ||
          before.courseId !== courseId ||
          before.startsAt.getTime() !== new Date(c.startsAt).getTime())
      )
        throw new StudentError('CONFLICT');
      const data = {
        ...c,
        courseId,
        startsAt: new Date(c.startsAt),
        endsAt: new Date(c.endsAt),
      };
      const session = id
        ? await tx.batchSession.update({ where: { id }, data })
        : await tx.batchSession.create({ data: { ...data, batchId } });
      await tx.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: id ? 'LiveSessionUpdated' : 'LiveSessionCreated',
          targetId: session.id,
          details: {
            before: before
              ? {
                  title: before.title,
                  instructorId: before.instructorId,
                  courseId: before.courseId,
                  itemId: before.itemId,
                  externalTargetId: before.externalTargetId,
                  locationLabel: before.locationLabel,
                  endsAt: before.endsAt.toISOString(),
                  startsAt: before.startsAt.toISOString(),
                  status: before.status,
                }
              : null,
            after: {
              title: c.title,
              instructorId: c.instructorId,
              courseId,
              itemId: c.itemId,
              externalTargetId: c.externalTargetId,
              locationLabel: c.locationLabel,
              endsAt: c.endsAt,
              startsAt: c.startsAt,
              status: c.status,
            },
          },
        },
      });
      return session.id;
    });
  }
}
