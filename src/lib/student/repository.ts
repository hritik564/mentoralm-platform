import { readStudentProfile, writeStudentProfile } from './profile';
import { CustomerSupportRepository } from './support';
import { enrollmentAccessWhere } from '../lms/enrollment-access';
import 'server-only';
import { randomBytes } from 'node:crypto';
import type { PrismaClient, Prisma } from '../../generated/prisma/client';
import { StudentError } from './errors';
import { viewInput, referralInput } from './validation';

export async function provisionUser(db: PrismaClient, clerkUserId: string) {
  if (!clerkUserId || clerkUserId.length > 200)
    throw new StudentError('UNAUTHENTICATED');
  // Unique-key upsert with bounded conflict retry. No email mapping or client-controlled role.
  return uniqueUpsert(() =>
    db.user.upsert({
      where: { clerkUserId },
      create: { clerkUserId },
      update: {},
      select: { id: true, role: true },
    }),
  );
}
async function uniqueUpsert<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (
        attempt >= 2 ||
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'P2002'
      )
        throw error;
    }
  }
}
function parse<T>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T } },
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new StudentError('INVALID_INPUT');
  return result.data!;
}
/** Trusted server repository. Actor is supplied by verified Clerk mapping, never HTTP input. */
export class StudentRepository {
  constructor(
    private db: PrismaClient,
    private actor: { id: string; role: 'STUDENT' | 'ADMIN' | 'INSTRUCTOR' },
  ) {
    if (actor.role !== 'STUDENT') throw new StudentError('FORBIDDEN');
  }
  profile() {
    return readStudentProfile(this.db, this.actor.id);
  }
  updateProfile(input: unknown) {
    return writeStudentProfile(this.db, this.actor.id, input);
  }
  async courses() {
    const [views, enrollments] = await Promise.all([
      this.db.courseView.findMany({
        where: { userId: this.actor.id, course: { published: true } },
        include: { course: { include: { program: true } } },
        orderBy: { lastViewedAt: 'desc' },
        take: 100,
      }),
      this.db.enrollment.findMany({
        where: { ...enrollmentAccessWhere(), userId: this.actor.id },
        include: { course: { include: { program: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
    ]);
    return { views, enrollments };
  }
  async recordView(input: unknown) {
    const { courseId } = parse(viewInput, input);
    if (
      !(await this.db.course.findFirst({
        where: { id: courseId, published: true },
        select: { id: true },
      }))
    )
      throw new StudentError('NOT_FOUND');
    await this.db.courseView.upsert({
      where: { userId_courseId: { userId: this.actor.id, courseId } },
      create: { userId: this.actor.id, courseId },
      update: { lastViewedAt: new Date() },
    });
  }
  private resourceAccess(): Prisma.ResourceWhereInput {
    return {
      published: true,
      OR: [
        { audience: 'STUDENTS' },
        {
          assignments: { some: { userId: this.actor.id } },
        },
        {
          audience: 'COURSE',
          course: {
            enrollments: {
              some: { ...enrollmentAccessWhere(), userId: this.actor.id },
            },
          },
        },
        {
          audience: 'PROGRAM',
          program: {
            courses: {
              some: {
                enrollments: {
                  some: { ...enrollmentAccessWhere(), userId: this.actor.id },
                },
              },
            },
          },
        },
      ],
    };
  }
  resources() {
    return this.db.resource.findMany({
      where: this.resourceAccess(),
      include: {
        course: { select: { title: true } },
        program: { select: { title: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }
  async resource(id: string) {
    const resource = await this.db.resource.findFirst({
      where: { AND: [{ id }, this.resourceAccess()] },
    });
    if (!resource) throw new StudentError('NOT_FOUND');
    return resource;
  }
  tickets() {
    return new CustomerSupportRepository(this.db, this.actor).tickets();
  }
  ticket(id: string) {
    return new CustomerSupportRepository(this.db, this.actor).ticket(id);
  }
  createTicket(input: unknown) {
    return new CustomerSupportRepository(this.db, this.actor).createTicket(
      input,
    );
  }
  reply(id: string, input: unknown) {
    return new CustomerSupportRepository(this.db, this.actor).reply(id, input);
  }
  async referral() {
    const identity = await uniqueUpsert(() =>
      this.db.referralIdentity.upsert({
        where: { userId: this.actor.id },
        create: {
          userId: this.actor.id,
          code: randomBytes(24).toString('base64url'),
        },
        update: {},
      }),
    );
    const history = await this.db.referralAttribution.findMany({
      where: { referrerId: this.actor.id },
      select: { referredUserId: true, joinedAt: true },
      orderBy: { joinedAt: 'desc' },
      take: 100,
    });
    return { identity, history };
  }
  async attributeReferral(input: unknown) {
    const { code } = parse(referralInput, input);
    const referral = await this.db.referralIdentity.findUnique({
      where: { code },
      select: { userId: true },
    });
    if (!referral) throw new StudentError('NOT_FOUND');
    if (referral.userId === this.actor.id) throw new StudentError('CONFLICT');
    const attribution = await uniqueUpsert(() =>
      this.db.referralAttribution.upsert({
        where: { referredUserId: this.actor.id },
        create: { referredUserId: this.actor.id, referrerId: referral.userId },
        update: {},
      }),
    );
    if (attribution.referrerId !== referral.userId)
      throw new StudentError('CONFLICT');
  }
}
