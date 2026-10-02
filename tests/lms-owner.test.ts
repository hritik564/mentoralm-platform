import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { localSeedUrl, verifyDatabase } from '../scripts/lms-owner/safety';
import { resetFixtures, seedIds } from '../scripts/lms-owner/fixtures';
import { LearningRepository } from '../src/lib/lms/learning';
import { Attempts } from '../src/lib/lms/attempts';
import { Discussions } from '../src/lib/lms/discussions';
import { Academics } from '../src/lib/lms/academics';

const safe = {
  DATABASE_URL: 'postgresql://local@127.0.0.1:5432/mentoralm_dev',
  CLERK_SECRET_KEY: 'sk_test_fixture',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture',
};
test('local seed guard rejects deployed environments, keys, origins and database overrides', () => {
  assert.match(localSeedUrl(safe), /mentoralm_dev/);
  const rejected = [
    { NODE_ENV: 'production' },
    { CI: '1' },
    { VERCEL: '1' },
    { NEXT_PUBLIC_SITE_URL: 'https://mentoralm.com' },
    { NEXT_PUBLIC_LMS_ORIGIN: 'https://students.mentoralm.com' },
    { CLERK_SECRET_KEY: 'sk_live_fixture' },
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_fixture' },
    { DATABASE_URL: 'postgresql://local@db.example.com/mentoralm_dev' },
    { DATABASE_URL: 'postgresql://local@localhost/mentoralm_test' },
    { DATABASE_URL: 'postgresql://local@localhost/mentoralm_prod' },
    { DATABASE_URL: 'postgresql://local@localhost/mentoralm_dev?host=remote' },
    { DATABASE_URL: 'postgresql://local@localhost/mentoralm_dev?schema=other' },
  ];
  for (const override of rejected)
    assert.throws(() => localSeedUrl({ ...safe, ...override }));
});
test(
  'explicit owner: idempotency, authorized reads, real completion, bounded reset and final reseed',
  { skip: !process.env.LMS_SEED_OWNER },
  async () => {
    const callerEnvironment = process.env.NODE_ENV;
    loadEnvConfig(process.cwd(), true);
    const url = localSeedUrl({
      ...process.env,
      NODE_ENV: callerEnvironment ?? process.env.NODE_ENV,
    });
    const owner = process.env.LMS_SEED_OWNER!;
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const matches = owner.startsWith('user_')
      ? [await clerk.users.getUser(owner)]
      : (await clerk.users.getUserList({ emailAddress: [owner], limit: 2 }))
          .data;
    assert.equal(matches.length, 1);
    const clerkId = matches[0].id;
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }, { schema: 'public' }),
    });
    const { id } = seedIds(clerkId);
    const run = (...args: string[]) =>
      execFileSync(
        process.execPath,
        [
          'node_modules/tsx/dist/cli.mjs',
          'scripts/lms-owner/seed.ts',
          '--owner',
          owner,
          ...args,
        ],
        {
          env: { ...process.env, NODE_OPTIONS: '--conditions=react-server' },
          stdio: 'pipe',
        },
      );
    const sentinel = `local_reset_sentinel_${randomUUID()}`;
    try {
      await verifyDatabase(db);
      run('--reset');
      run();
      const user = await db.user.findUniqueOrThrow({
        where: { clerkUserId: clerkId },
      });
      assert.equal(user.role, 'STUDENT');
      assert.ok(user.studentId);
      const marker = await db.academicAudit.findUniqueOrThrow({
        where: { id: id('marker') },
      });
      const snapshot = async () => ({
        sections: await db.section.count({ where: { courseId: id('course') } }),
        items: await db.learningItem.count({
          where: { section: { courseId: id('course') } },
        }),
        questions: await db.question.count({ where: { bankId: id('bank') } }),
        sessions: await db.batchSession.count({
          where: { batchId: id('batch') },
        }),
        threads: await db.discussionThread.count({
          where: { courseId: id('course') },
        }),
        enrollment: await db.enrollment.count({
          where: { userId: user.id, courseId: id('course') },
        }),
      });
      const before = await snapshot();
      run();
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual(before, {
        sections: 3,
        items: 11,
        questions: 5,
        sessions: 5,
        threads: 3,
        enrollment: 1,
      });
      const actor = { id: user.id, role: 'STUDENT' as const };
      const learning = new LearningRepository(db, actor);
      assert.ok(await learning.course(id('course')));
      assert.ok(
        (await learning.dashboardSummaries()).some(
          (course) => course.id === id('course'),
        ),
      );
      const lesson = await learning.lesson(id('course'), id('pdf'));
      assert.ok(lesson);
      assert.equal((await learning.resources(id('course'))).length, 1);
      assert.ok(await new Discussions(db, user.id).thread(id('thread0')));
      assert.equal(
        await db.certificate.count({ where: { courseId: id('course') } }),
        0,
      );
      const attempts = new Attempts(db, user.id);
      const attempt = await attempts.start(id('course'), id('quiz'));
      for (const q of attempt.questions)
        for (const option of q.options)
          assert.ok(!Object.hasOwn(option, 'correct'));
      await attempts.save(id('course'), id('quiz'), attempt.id, {
        answers: attempt.questions.map((question) => ({
          questionId: question.id,
          optionIds: [question.options[question.options.length - 1].id],
        })),
      });
      await attempts.submit(id('course'), id('quiz'), attempt.id);
      assert.equal(
        (
          await db.academicAttempt.findUniqueOrThrow({
            where: { id: attempt.id },
          })
        ).passed,
        false,
      );
      run('--completed');
      const completed = await db.enrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId: user.id, courseId: id('course') } },
      });
      assert.equal(completed.status, 'COMPLETED');
      assert.ok(completed.completedAt);
      const cert = await db.certificate.findUniqueOrThrow({
        where: { userId_courseId: { userId: user.id, courseId: id('course') } },
      });
      assert.equal(cert.status, 'ACTIVE');
      assert.equal(cert.storageKey, null);
      assert.ok((await new Academics(db, actor).certificates()).length);
      run('--completed');
      assert.equal(
        await db.certificate.count({
          where: { userId: user.id, courseId: id('course') },
        }),
        1,
      );
      await db.course.create({
        data: {
          id: sentinel,
          title: 'Unrelated reset safety sentinel',
          description: 'Temporary focused verification record.',
          thumbnailPath: '/images/campus.webp',
          thumbnailAlt: 'Campus',
          publicPath: '/#programs',
        },
      });
      await db.enrollment.create({
        data: { userId: user.id, courseId: sentinel },
      });
      await db.section.create({
        data: {
          id: sentinel,
          courseId: id('course'),
          title: 'Unowned authoring safety sentinel',
          position: 99,
        },
      });
      await assert.rejects(resetFixtures(db, user.id, clerkId), /non-owned/);
      assert.ok(await db.course.findUnique({ where: { id: id('course') } }));
      await db.section.delete({ where: { id: sentinel } });
      run('--reset');
      assert.equal(
        await db.course.findUnique({ where: { id: id('course') } }),
        null,
      );
      assert.ok(
        await db.enrollment.findUnique({
          where: { userId_courseId: { userId: user.id, courseId: sentinel } },
        }),
      );
      const retained = await db.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      assert.equal(retained.studentId, user.studentId);
      assert.equal(retained.clerkUserId, user.clerkUserId);
      assert.equal(
        retained.lmsAccessOverride,
        (marker.details as { previousOverride: string | null })
          .previousOverride,
      );
      run('--reset');
      run();
      assert.deepEqual(await snapshot(), before);
      assert.equal(
        await db.certificate.count({ where: { courseId: id('course') } }),
        0,
      );
      console.log(
        'Owner fixture verified: default incomplete coursework, valid completed mode, private answer keys, idempotency, reset refusal and unrelated-record preservation; default seed restored.',
      );
    } finally {
      await db.enrollment.deleteMany({ where: { courseId: sentinel } });
      await db.section.deleteMany({ where: { id: sentinel } });
      await db.course.deleteMany({ where: { id: sentinel } });
      await db.$disconnect();
    }
  },
);
