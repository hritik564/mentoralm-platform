import 'server-only';
import { randomBytes } from 'node:crypto';
import type { PrismaClient, Prisma } from '../../generated/prisma/client';
import { StudentError } from './errors';
import {
  profileInput,
  replyInput,
  ticketInput,
  viewInput,
  referralInput,
} from './validation';

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
    private actor: { id: string; role: 'STUDENT' | 'ADMIN' },
  ) {
    if (actor.role !== 'STUDENT') throw new StudentError('FORBIDDEN');
  }
  profile() {
    return this.db.studentProfile.findUnique({
      where: { userId: this.actor.id },
      select: {
        educationLevel: true,
        institution: true,
        graduationYear: true,
        interests: true,
        careerGoals: true,
      },
    });
  }
  async updateProfile(input: unknown) {
    const data = parse(profileInput, input);
    const writable = {
      educationLevel: data.educationLevel,
      institution: data.institution,
      graduationYear: data.graduationYear,
      interests: data.interests,
      careerGoals: data.careerGoals,
    };
    await this.db.studentProfile.upsert({
      where: { userId: this.actor.id },
      create: { userId: this.actor.id, ...writable },
      update: writable,
    });
    return this.profile();
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
        where: { userId: this.actor.id },
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
        { assignments: { some: { userId: this.actor.id } } },
        {
          audience: 'COURSE',
          course: { enrollments: { some: { userId: this.actor.id } } },
        },
        {
          audience: 'PROGRAM',
          program: {
            courses: {
              some: { enrollments: { some: { userId: this.actor.id } } },
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
    return this.db.supportTicket.findMany({
      where: { userId: this.actor.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }
  async ticket(id: string) {
    const ticket = await this.db.supportTicket.findFirst({
      where: { id, userId: this.actor.id },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 200 } },
    });
    if (!ticket) throw new StudentError('NOT_FOUND');
    return ticket;
  }
  async createTicket(input: unknown) {
    const draft = parse(ticketInput, input);
    return this.db.supportTicket.create({
      data: {
        userId: this.actor.id,
        reference: `MT-${randomBytes(8).toString('hex').toUpperCase()}`,
        category: draft.category,
        subject: draft.subject,
        messages: {
          create: {
            senderId: this.actor.id,
            actor: 'STUDENT',
            body: draft.message,
          },
        },
      },
      select: { id: true },
    });
  }
  async reply(id: string, input: unknown) {
    const { message } = parse(replyInput, input);
    // Serializable transaction coordinates reply permission with future status changes.
    await this.db.$transaction(
      async (transaction) => {
        const ticket = await transaction.supportTicket.findFirst({
          where: { id, userId: this.actor.id },
        });
        if (!ticket) throw new StudentError('NOT_FOUND');
        if (!['OPEN', 'IN_PROGRESS'].includes(ticket.status))
          throw new StudentError('CONFLICT');
        await transaction.supportMessage.create({
          data: {
            ticketId: id,
            senderId: this.actor.id,
            actor: 'STUDENT',
            body: message,
          },
        });
        await transaction.supportTicket.update({
          where: { id },
          data: { updatedAt: new Date() },
        });
      },
      { isolationLevel: 'Serializable' },
    );
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
