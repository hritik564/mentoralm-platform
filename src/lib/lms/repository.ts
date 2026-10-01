import 'server-only';
import type { PrismaClient } from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import type { LmsBatch } from './batches';
import { entitledStudentWhere } from './entitlement';
export class LmsRepository {
  constructor(
    private db: PrismaClient,
    private actor: { id: string; role: 'STUDENT' | 'ADMIN' | 'INSTRUCTOR' },
  ) {
    if (actor.role !== 'STUDENT') throw new StudentError('FORBIDDEN');
  }
  async authorize() {
    const allowed = await this.db.user.findFirst({
      where: entitledStudentWhere(this.actor.id),
      select: { id: true },
    });
    if (!allowed) throw new StudentError('FORBIDDEN');
  }
  async studentId() {
    await this.authorize();
    const user = await this.db.user.findFirst({
      where: entitledStudentWhere(this.actor.id),
      select: { studentId: true },
    });
    if (!user?.studentId) throw new StudentError('UNAVAILABLE');
    return user.studentId;
  }
  async batches(): Promise<LmsBatch[]> {
    await this.authorize();
    const memberships = await this.db.batchMembership.findMany({
      where: {
        userId: this.actor.id,
        student: entitledStudentWhere(this.actor.id),
      },
      include: {
        batch: {
          include: {
            program: { select: { title: true } },
            course: { select: { title: true } },
            _count: { select: { instructors: true } },
          },
        },
      },
      orderBy: { batch: { code: 'asc' } },
      take: 100,
    });
    return memberships.map(({ batch, status }) => ({
      name: batch.name,
      code: batch.code,
      status: batch.status,
      membershipStatus: status,
      startsAt: batch.startsAt?.toISOString() || null,
      endsAt: batch.endsAt?.toISOString() || null,
      scope: batch.program?.title || batch.course?.title || null,
      instructors: batch._count.instructors,
    }));
  }
  async courses() {
    await this.authorize();
    const enrollments = await this.db.enrollment.findMany({
      where: {
        userId: this.actor.id,
        user: entitledStudentWhere(this.actor.id),
        course: { published: true },
      },
      select: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            program: { select: { title: true } },
          },
        },
      },
      orderBy: [{ enrolledAt: 'desc' }, { courseId: 'asc' }],
      take: 100,
    });
    return enrollments.map(({ course }) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      program: course.program?.title || null,
    }));
  }
  async courseStructure(courseId: string) {
    await this.authorize();
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(courseId))
      throw new StudentError('NOT_FOUND');
    const course = await this.db.course.findFirst({
      where: {
        id: courseId,
        published: true,
        enrollments: {
          some: {
            userId: this.actor.id,
            user: entitledStudentWhere(this.actor.id),
          },
        },
      },
      select: {
        title: true,
        description: true,
        program: { select: { title: true } },
        sections: {
          where: { published: true },
          orderBy: { position: 'asc' },
          select: {
            title: true,
            description: true,
            position: true,
            items: {
              where: { published: true },
              orderBy: { position: 'asc' },
              select: { title: true, type: true, position: true },
            },
          },
        },
      },
    });
    if (!course) throw new StudentError('NOT_FOUND');
    return course;
  }
}
