import { legacyAdminPermissions } from '../../src/lib/admin/permissions';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { localSeedUrl, verifyDatabase } from '../../scripts/lms-owner/safety';
import { studentSnapshot } from '../../scripts/admin-owner/snapshot';
import { requireAdmin } from '../../src/lib/auth/roles';
import { isolatedDatabase } from './d4-database';
import { academicFixture } from './l3-fixtures';
import { Attempts } from '../../src/lib/lms/attempts';
import { Assignments } from '../../src/lib/lms/assignments';
import { Discussions } from '../../src/lib/lms/discussions';
import { LearningRepository } from '../../src/lib/lms/learning';
import { StudentRepository } from '../../src/lib/student/repository';
import { AdminOperationalRepository } from '../../src/lib/admin/operational/read';
import { adminHandle as h } from '../../src/lib/admin/handles';
const a4 = process.env.ADMIN_REVIEW_PHASE === 'a4';
const reviewDirectory = `docs/reviews/admin-${a4 ? 'a4' : 'a3'}`;
async function main() {
  const f = await isolatedDatabase(process.env.A3_TEST_SCHEMA),
    root = await mkdtemp(join(tmpdir(), 'mentoralm-a3-browser-')),
    clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }),
    dev = new PrismaClient({
      adapter: new PrismaPg({ connectionString: localSeedUrl(process.env) }),
    });
  let temporaryClerkId: string | undefined;
  async function cleanup() {
    await f.cleanup();
    await rm(root, { recursive: true, force: true });
    if (temporaryClerkId) await clerk.users.deleteUser(temporaryClerkId);
    await dev.$disconnect();
    await rm(`${reviewDirectory}/fixture.json`, { force: true });
  }
  try {
    await verifyDatabase(dev);
    const users = (
      await clerk.users.getUserList({
        emailAddress: ['arcaderobo3@gmail.com'],
        limit: 2,
      })
    ).data;
    if (users.length !== 1) throw Error('Existing owner not uniquely resolved');
    const realOwner = await dev.user.findUniqueOrThrow({
      where: { clerkUserId: users[0].id },
    });
    await requireAdmin(dev, realOwner.id);
    const before = await studentSnapshot(dev, realOwner.id);
    await mkdir(reviewDirectory, { recursive: true });
    // Same real Clerk owner; only an isolated Test representation, never another Development identity.
    const owner = await f.db.user.create({
      data: { clerkUserId: realOwner.clerkUserId, role: 'STUDENT' },
    });
    await f.db.userRoleAssignment.create({
      data: { userId: owner.id, role: 'ADMIN' },
    });
    await f.db.adminAuthorization.create({
      data: {
        userId: owner.id,
        ...(a4
          ? { authority: 'GOVERNANCE' as const }
          : { permissions: legacyAdminPermissions }),
      },
    });
    const temporary = await clerk.users.createUser({
      emailAddress: [`a3-${randomUUID()}+clerk_test@example.com`],
      firstName: 'A3 Review',
      lastName: 'Student',
      skipPasswordRequirement: true,
    });
    temporaryClerkId = temporary.id;
    const student = await f.db.user.create({
        data: { clerkUserId: temporary.id, lmsAccessOverride: 'ENABLED' },
      }),
      other = await f.db.user.create({
        data: { clerkUserId: `a3-other-${randomUUID()}` },
      }),
      x = await academicFixture(f.db, student.id, 'a3browser');
    process.env.LMS_SUBMISSIONS_ROOT = root;
    await f.db.learningItem.updateMany({
      where: { sectionId: x.section.id, type: { not: 'LESSON' } },
      data: { required: false },
    });
    const attempts = new Attempts(f.db, student.id),
      a = await attempts.start(x.course.id, x.assessment.id);
    await attempts.save(x.course.id, x.assessment.id, a.id, {
      answers: [
        { questionId: x.single.id, optionIds: [x.single.options[0].id] },
        {
          questionId: x.short.id,
          text: 'I clarify the goal and use a focused example.',
        },
        {
          questionId: x.long.id,
          text: 'I compare the result with the goal, seek feedback, and improve my next iteration.',
        },
      ],
    });
    await attempts.submit(x.course.id, x.assessment.id, a.id);
    await new Assignments(f.db, student.id).submit(
      x.course.id,
      x.assignment.id,
      {
        requestKey: randomUUID(),
        kind: 'TEXT_AND_FILE',
        text: 'My practice notes explain a clear goal, useful context and a measurable outcome.',
      },
      [
        new File(['Private A3 practice notes'], 'practice-notes.txt', {
          type: 'text/plain',
        }),
      ],
    );
    const submission = await f.db.assignmentSubmission.findFirstOrThrow({
      where: { userId: student.id },
    });
    await new LearningRepository(f.db, student).record(
      x.course.id,
      x.lesson.id,
      true,
    );
    const certificate = await f.db.certificate.findFirstOrThrow({
        where: { userId: student.id },
      }),
      thread = await new Discussions(f.db, student.id).create({
        courseId: x.course.id,
        batchId: x.batch.id,
        title: 'How do you improve a first draft?',
        body: 'I would like feedback on balancing useful context with a concise goal.',
      }),
      ticket = await new StudentRepository(f.db, student).createTicket({
        category: 'Technical',
        subject: 'Help opening my practice notes',
        message:
          'Could you help me access the attached notes from the assignment?',
      });
    await f.db.referralIdentity.create({
      data: { userId: student.id, code: 'A3-REVIEW' },
    });
    await f.db.referralAttribution.create({
      data: { referredUserId: other.id, referrerId: student.id },
    });
    const ops = new AdminOperationalRepository(
        f.db,
        owner.id,
        { search: async () => [], lookup: async () => new Map() },
        f.schema,
      ),
      message = await ops.plan({
        batchId: x.batch.id,
        channel: 'EMAIL',
        purpose: 'MARKETING',
        subject: 'A3 review communication plan',
        body: 'This is a provider-pending test plan. Nothing is sent.',
      });
    await writeFile(
      `${reviewDirectory}/fixture.json`,
      JSON.stringify({
        schema: f.schema,
        filesRoot: root,
        before,
        ownerClerkId: realOwner.clerkUserId,
        studentClerkId: temporary.id,
        ownerId: owner.id,
        studentId: student.id,
        courseId: x.course.id,
        lessonId: x.lesson.id,
        refs: {
          user: h('user', student.id),
          course: h('course', x.course.id),
          attendance: h('session', x.session.id),
          submissions: h('submission', submission.id),
          attempts: h('attempt', a.id),
          certificates: h('certificate', certificate.id),
          discussions: h('thread', thread.id),
          support: h('ticket', ticket.id),
          communications: h('message', message.id),
          referrals: h('student', student.id),
          other: h('student', other.id),
        },
      }),
    );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      MENTORALM_ENV: 'test',
      DATABASE_URL: f.url,
      LMS_SUBMISSIONS_ROOT: root,
    };
    delete env.NODE_OPTIONS;
    const child = spawn(
      process.execPath,
      [
        'scripts/production/start.mjs',
        '--hostname',
        '127.0.0.1',
        '--port',
        a4 ? '3104' : '3103',
      ],
      { stdio: 'inherit', env },
    );
    for (const signal of ['SIGINT', 'SIGTERM'] as const)
      process.on(signal, () => child.kill(signal));
    child.on('exit', async (code) => {
      // Playwright global teardown owns fixture removal, including after a forced server exit.
      await f.db.$disconnect();
      await dev.$disconnect();
      process.exit(code || 0);
    });
  } catch (error) {
    await cleanup();
    throw error;
  }
}
main().catch(() => {
  console.error(
    'A3 guarded isolated test server setup failed; configuration withheld.',
  );
  process.exit(1);
});
