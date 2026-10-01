import 'server-only';
import type { PrismaClient } from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { Attempts } from './attempts';
import { Assignments } from './assignments';
import { attendanceProjection } from './attendance';
import { LearningRepository, courseAccessWhere } from './learning';
import { entitledStudentWhere } from './entitlement';
export class Academics {
  readonly attempts: Attempts;
  readonly assignments: Assignments;
  constructor(
    private db: PrismaClient,
    private actor: { id: string; role: 'STUDENT' | 'ADMIN' | 'INSTRUCTOR' },
  ) {
    if (actor.role !== 'STUDENT') throw new StudentError('FORBIDDEN');
    this.attempts = new Attempts(db, actor.id);
    this.assignments = new Assignments(db, actor.id);
  }
  async attendance() {
    if (
      !(await this.db.user.findFirst({
        where: entitledStudentWhere(this.actor.id),
        select: { id: true },
      }))
    )
      throw new StudentError('FORBIDDEN');
    return attendanceProjection(this.db, this.actor.id);
  }
  async certificates() {
    const courses = await new LearningRepository(
      this.db,
      this.actor,
    ).dashboardSummaries();
    const eligible = courses
      .filter((c) => c.completion.certificateEligible)
      .map((c) => c.id);
    const records = await this.db.certificate.findMany({
      where: {
        userId: this.actor.id,
        status: 'ACTIVE',
        courseId: { in: eligible },
        course: courseAccessWhere(this.actor.id),
      },
      select: {
        code: true,
        issuedAt: true,
        courseId: true,
        storageKey: true,
        mimeType: true,
        fileName: true,
        course: { select: { title: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });
    return records.map((c) => ({
      code: c.code,
      issuedAt: c.issuedAt.toISOString(),
      courseId: c.courseId,
      course: c.course.title,
      fileName: c.fileName,
      documentAvailable: !!(
        process.env.LMS_FILES_ROOT &&
        c.storageKey &&
        c.mimeType === 'application/pdf' &&
        c.fileName
      ),
    }));
  }
  async certificate(code: string) {
    const record = (await this.certificates()).find((c) => c.code === code);
    if (!record) throw new StudentError('NOT_FOUND');
    return record;
  }
  async certificateFile(code: string) {
    const record = await this.certificate(code);
    if (!record.documentAvailable) throw new StudentError('UNAVAILABLE');
    const file = await this.db.certificate.findFirst({
      where: {
        code,
        userId: this.actor.id,
        status: 'ACTIVE',
        course: courseAccessWhere(this.actor.id),
      },
      select: { storageKey: true, mimeType: true, fileName: true },
    });
    if (!file || file.mimeType !== 'application/pdf' || !file.fileName)
      throw new StudentError('NOT_FOUND');
    return {
      ...file,
      mimeType: file.mimeType,
      fileName: file.fileName,
      downloadAllowed: true,
    };
  }
}
