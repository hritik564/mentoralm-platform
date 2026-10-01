import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { isolatedDatabase, testDatabaseUrl } from './helpers/d4-database';
import { randomBytes } from 'node:crypto';
import {
  provisionUser,
  StudentRepository,
} from '../src/lib/student/repository';
import { LmsRepository } from '../src/lib/lms/repository';
import { currentBatch, type LmsBatch } from '../src/lib/lms/batches';
import { profileInput } from '../src/lib/student/validation';
import { resolveLearningLaunch } from '../src/lib/dashboard/learning-launch';
import { dashboardDestination } from '../src/lib/auth/redirects';
import { entitledStudentWhere } from '../src/lib/lms/entitlement';
import {
  deploymentOrigins,
  domainRoute,
  lmsHref,
  websiteHref,
} from '../src/lib/platform/domains';
const live = !!testDatabaseUrl();
test('current batch uses active statuses/dates with deterministic tie-breaks', () => {
  const base: LmsBatch = {
    name: 'Fixture',
    code: 'AAA-26',
    status: 'ACTIVE',
    membershipStatus: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: null,
    scope: null,
    instructors: 0,
  };
  assert.equal(
    currentBatch([{ ...base, code: 'BBB-26' }, base], new Date('2026-10-01'))
      ?.code,
    'AAA-26',
  );
  assert.equal(
    currentBatch(
      [
        { ...base, status: 'PLANNED' },
        { ...base, membershipStatus: 'INACTIVE' },
        { ...base, startsAt: '2027-01-01' },
        { ...base, endsAt: '2026-02-01' },
      ],
      new Date('2026-10-01'),
    ),
    null,
  );
  assert.equal(
    currentBatch(
      [base, { ...base, code: 'LATER-26', startsAt: '2026-09-01' }],
      new Date('2026-10-01'),
    )?.code,
    'LATER-26',
  );
});
test('controlled launch and redirect paths reject arbitrary URLs and student identifiers', () => {
  assert.equal(
    resolveLearningLaunch({ destinationId: 'lms-course-courseA' }),
    '/learn/courses/courseA',
  );
  for (const id of [
    'lms-course-../secret',
    'lms-course-https://evil.test',
    'MLM-STU-2026-000001',
  ])
    assert.equal(resolveLearningLaunch({ destinationId: id }), null);
  assert.equal(
    dashboardDestination('/learn/courses/courseA'),
    '/learn/courses/courseA',
  );
  for (const destination of [
    'https://evil.test',
    '/learn/courses/a?redirect_url=https://evil.test',
    '/learn/../admin',
    '//evil.test',
  ])
    assert.equal(dashboardDestination(destination), '/dashboard');
  assert.equal(
    profileInput.safeParse({ studentId: 'MLM-STU-2026-000001' }).success,
    false,
  );
});
test('locked domain configuration and host routing preserve controlled LMS destinations', () => {
  const origins = deploymentOrigins(
    'https://mentoralm.com',
    'https://students.mentoralm.com',
  );
  assert.equal(lmsHref('/learn', origins), 'https://students.mentoralm.com/');
  assert.equal(
    lmsHref('/learn/courses/courseA', origins),
    'https://students.mentoralm.com/courses/courseA',
  );
  assert.equal(
    websiteHref('/dashboard/support', origins),
    'https://mentoralm.com/dashboard/support',
  );
  assert.deepEqual(domainRoute('students.mentoralm.com', '/', origins), {
    kind: 'rewrite',
    path: '/learn',
  });
  assert.deepEqual(
    domainRoute('students.mentoralm.com', '/courses/courseA', origins),
    { kind: 'rewrite', path: '/learn/courses/courseA' },
  );
  assert.deepEqual(
    domainRoute('students.mentoralm.com', '/dashboard', origins),
    { kind: 'redirect', path: 'https://mentoralm.com/dashboard' },
  );
  assert.deepEqual(domainRoute('mentoralm.com', '/learn/lectures', origins), {
    kind: 'redirect',
    path: 'https://students.mentoralm.com/lectures',
  });
  assert.deepEqual(domainRoute('mentoralm.com', '/gradlm', origins), {
    kind: 'next',
    path: '/gradlm',
  });
  assert.deepEqual(
    domainRoute('students.mentoralm.com.evil.test', '/', origins),
    { kind: 'next', path: '/' },
  );
  for (const value of [
    'https://evil.test',
    'http://students.mentoralm.com',
    'https://students.mentoralm.com/path',
    'https://students.mentoralm.com?next=evil',
    'https://user@students.mentoralm.com',
  ])
    assert.throws(() => deploymentOrigins('https://mentoralm.com', value));
  assert.throws(() => lmsHref('//evil.test', origins));
  assert.throws(() => websiteHref('/../admin', origins));
  const savedSite = process.env.NEXT_PUBLIC_SITE_URL,
    savedLms = process.env.NEXT_PUBLIC_LMS_ORIGIN;
  try {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mentoralm.com';
    process.env.NEXT_PUBLIC_LMS_ORIGIN = 'https://students.mentoralm.com';
    assert.equal(
      resolveLearningLaunch({ destinationId: 'lms-course-courseA' }),
      'https://students.mentoralm.com/courses/courseA',
    );
    assert.equal(
      dashboardDestination('https://students.mentoralm.com/courses/courseA'),
      'https://students.mentoralm.com/courses/courseA',
    );
    for (const value of [
      'https://students.mentoralm.com.evil.test/courses/a',
      'https://students.mentoralm.com/courses/a?x=1',
      'https://students.mentoralm.com/courses/a/../b',
      'https://students.mentoralm.com/admin',
    ])
      assert.equal(dashboardDestination(value), '/dashboard');
  } finally {
    if (savedSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = savedSite;
    if (savedLms === undefined) delete process.env.NEXT_PUBLIC_LMS_ORIGIN;
    else process.env.NEXT_PUBLIC_LMS_ORIGIN = savedLms;
  }
});
test(
  'L1 clean migration, student identifiers, cohorts, instructors and course ownership',
  { skip: !live },
  async (t) => {
    const isolated = await isolatedDatabase();
    const db = isolated.db;
    try {
      const A = await provisionUser(db, 'l1_A'),
        B = await provisionUser(db, 'l1_B');
      // Authorized no-batch fixtures exercise identity independently of inheritance.
      await db.user.updateMany({
        where: { id: { in: [A.id, B.id] } },
        data: { lmsAccessOverride: 'ENABLED' },
      });
      const repoA = new LmsRepository(db, A),
        repoB = new LmsRepository(db, B);
      await t.test(
        'all five migrations complete and student IDs issue once under concurrency',
        async () => {
          const records = await db.$queryRawUnsafe<
            Array<{ finished_at: Date }>
          >(
            `SELECT finished_at FROM "${isolated.schema}"."_prisma_migrations"`,
          );
          assert.equal(records.length, 5);
          assert.ok(records.every((row) => row.finished_at));
          const same = await Promise.all(
            Array.from({ length: 24 }, () =>
              provisionUser(db, 'l1_concurrent'),
            ),
          );
          assert.equal(new Set(same.map((row) => row.id)).size, 1);
          const users = await Promise.all(
            Array.from({ length: 24 }, (_, i) =>
              provisionUser(db, `l1_distinct_${i}`),
            ),
          );
          const identifiers = await db.user.findMany({
            where: { id: { in: users.map((row) => row.id) } },
            select: { studentId: true },
          });
          assert.equal(
            new Set(identifiers.map((row) => row.studentId)).size,
            24,
          );
          assert.ok(
            identifiers.every((row) =>
              /^MLM-STU-\d{4}-\d{6,}$/.test(row.studentId!),
            ),
          );
          const initial = await repoA.studentId();
          await provisionUser(db, 'l1_A');
          assert.equal(await repoA.studentId(), initial);
          await assert.rejects(
            db.user.update({ where: { id: A.id }, data: { studentId: null } }),
          );
          await assert.rejects(
            db.user.update({
              where: { id: B.id },
              data: { studentId: initial },
            }),
          );
          await assert.rejects(
            db.user.create({
              data: { clerkUserId: 'spoof', studentId: initial },
            }),
          );
        },
      );
      const program = await db.program.create({
        data: { title: 'L1 fixture program' },
      });
      const course = await db.course.create({
        data: {
          title: 'L1 fixture course',
          description: 'Fixture',
          programId: program.id,
          thumbnailPath: '/images/campus.webp',
          thumbnailAlt: 'Fixture',
          publicPath: '/#programs',
          published: true,
        },
      });
      const batch = await db.batch.create({
        data: {
          code: 'CIG-2026-OCT-A',
          name: 'October cohort',
          status: 'ACTIVE',
          programId: program.id,
          startsAt: new Date('2026-01-01'),
        },
      });
      const otherBatch = await db.batch.create({
        data: {
          code: 'GRAD-2027-A',
          name: 'January cohort',
          status: 'PLANNED',
          courseId: course.id,
          startsAt: new Date('2027-01-01'),
        },
      });
      await t.test(
        'multiple memberships, unique code/relationship and valid dates/scopes',
        async () => {
          await db.batchMembership.createMany({
            data: [
              { userId: A.id, batchId: batch.id },
              { userId: A.id, batchId: otherBatch.id },
            ],
          });
          assert.equal((await repoA.batches()).length, 2);
          assert.equal((await repoB.batches()).length, 0);
          assert.equal(
            currentBatch(await repoA.batches(), new Date('2026-10-01'))?.code,
            batch.code,
          );
          await assert.rejects(
            db.batchMembership.create({
              data: { userId: A.id, batchId: batch.id },
            }),
          );
          await assert.rejects(
            db.batch.create({ data: { name: 'Duplicate', code: batch.code } }),
          );
          await assert.rejects(
            db.batch.create({
              data: {
                name: 'Bad dates',
                code: 'BAD-DATES',
                startsAt: new Date('2027-01-01'),
                endsAt: new Date('2026-01-01'),
              },
            }),
          );
          await assert.rejects(
            db.batch.create({
              data: {
                name: 'Ambiguous',
                code: 'BAD-SCOPE',
                courseId: course.id,
                programId: program.id,
              },
            }),
          );
        },
      );
      await t.test(
        'LMS entitlement defaults deny, overrides win, inheritance uses any applicable enabled cohort and revokes immediately',
        async () => {
          const C = await provisionUser(db, 'l1_entitlement');
          const repo = new LmsRepository(db, C);
          const now = new Date('2026-10-01T12:00:00Z');
          const allowed = async () =>
            !!(await db.user.findFirst({
              where: entitledStudentWhere(C.id, now),
              select: { id: true },
            }));
          assert.equal(await allowed(), false);
          for (const read of [
            () => repo.studentId(),
            () => repo.batches(),
            () => repo.courses(),
            () => repo.courseStructure(course.id),
          ])
            await assert.rejects(read(), { code: 'FORBIDDEN' });
          await db.enrollment.create({
            data: { userId: C.id, courseId: course.id },
          });
          await assert.rejects(repo.courseStructure(course.id), {
            code: 'FORBIDDEN',
          });
          await db.user.update({
            where: { id: C.id },
            data: { lmsAccessOverride: 'ENABLED' },
          });
          assert.equal(await allowed(), true);
          await repo.courseStructure(course.id);
          await db.user.update({
            where: { id: C.id },
            data: { lmsAccessOverride: null },
          });
          const cohort = await db.batch.create({
            data: {
              code: 'ACCESS-26',
              name: 'Entitlement fixture',
              status: 'ACTIVE',
              startsAt: new Date('2026-01-01'),
              lmsAccessEnabled: true,
            },
          });
          const membership = await db.batchMembership.create({
            data: {
              batchId: cohort.id,
              userId: C.id,
              joinedAt: new Date('2026-01-01'),
            },
          });
          assert.equal(await allowed(), true);
          await repo.courseStructure(course.id);
          await db.user.update({
            where: { id: C.id },
            data: { lmsAccessOverride: 'DISABLED' },
          });
          assert.equal(await allowed(), false);
          await assert.rejects(repo.courseStructure(course.id), {
            code: 'FORBIDDEN',
          });
          await db.user.update({
            where: { id: C.id },
            data: { lmsAccessOverride: null },
          });
          for (const data of [
            { lmsAccessEnabled: false },
            { status: 'PLANNED' as const },
            { status: 'COMPLETED' as const },
            { status: 'ARCHIVED' as const },
            { startsAt: new Date('2027-01-01') },
            { endsAt: new Date('2026-02-01') },
          ]) {
            await db.batch.update({ where: { id: cohort.id }, data });
            assert.equal(await allowed(), false);
            await db.batch.update({
              where: { id: cohort.id },
              data: {
                lmsAccessEnabled: true,
                status: 'ACTIVE',
                startsAt: new Date('2026-01-01'),
                endsAt: null,
              },
            });
          }
          for (const data of [
            { status: 'INACTIVE' as const },
            { joinedAt: new Date('2027-01-01') },
            { leftAt: new Date('2026-02-01') },
          ]) {
            await db.batchMembership.update({
              where: { id: membership.id },
              data,
            });
            assert.equal(await allowed(), false);
            await db.batchMembership.update({
              where: { id: membership.id },
              data: {
                status: 'ACTIVE',
                joinedAt: new Date('2026-01-01'),
                leftAt: null,
              },
            });
          }
          await db.batch.update({
            where: { id: cohort.id },
            data: { startsAt: now, endsAt: now },
          });
          assert.equal(await allowed(), true);
          await db.batch.update({
            where: { id: cohort.id },
            data: {
              startsAt: new Date('2026-01-01'),
              endsAt: null,
              lmsAccessEnabled: false,
            },
          });
          const second = await db.batch.create({
            data: {
              code: 'ACCESS-SECOND',
              name: 'Other enabled cohort',
              status: 'ACTIVE',
              lmsAccessEnabled: true,
            },
          });
          await db.batchMembership.create({
            data: {
              batchId: second.id,
              userId: C.id,
              joinedAt: new Date('2026-01-01'),
            },
          });
          assert.equal(await allowed(), true);
          await db.batch.update({
            where: { id: second.id },
            data: { lmsAccessEnabled: false },
          });
          assert.equal(await allowed(), false);
          await db.user.update({
            where: { id: C.id },
            data: { lmsAccessOverride: 'ENABLED' },
          });
          assert.equal(await allowed(), true);
          await db.enrollment.delete({
            where: { userId_courseId: { userId: C.id, courseId: course.id } },
          });
          await assert.rejects(repo.courseStructure(course.id), {
            code: 'NOT_FOUND',
          });
          assert.equal(
            (await db.batch.findUniqueOrThrow({ where: { id: batch.id } }))
              .lmsAccessEnabled,
            false,
          );
        },
      );
      await t.test(
        'INSTRUCTOR remains distinct; multiple instructors enforced by role-aware FKs',
        async () => {
          const I = await db.user.create({
            data: { clerkUserId: 'l1_instructor_1', role: 'INSTRUCTOR' },
          });
          const J = await db.user.create({
            data: { clerkUserId: 'l1_instructor_2', role: 'INSTRUCTOR' },
          });
          const admin = await db.user.create({
            data: { clerkUserId: 'l1_admin', role: 'ADMIN' },
          });
          assert.equal(I.studentId, null);
          assert.equal(admin.studentId, null);
          await db.batchInstructor.createMany({
            data: [
              { batchId: batch.id, instructorId: I.id },
              { batchId: batch.id, instructorId: J.id },
            ],
          });
          assert.equal(
            (await repoA.batches()).find((row) => row.code === batch.code)
              ?.instructors,
            2,
          );
          await assert.rejects(
            db.batchInstructor.create({
              data: { batchId: otherBatch.id, instructorId: A.id },
            }),
          );
          await assert.rejects(
            db.batchInstructor.create({
              data: { batchId: otherBatch.id, instructorId: admin.id },
            }),
          );
          await assert.rejects(
            db.batchMembership.create({
              data: { batchId: batch.id, userId: I.id },
            }),
          );
          assert.throws(() => new LmsRepository(db, I));
          assert.throws(() => new StudentRepository(db, I));
          assert.throws(() => new LmsRepository(db, admin));
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: A.id } })).role,
            'STUDENT',
          );
        },
      );
      await t.test(
        'batch membership and Student ID never authorize course access',
        async () => {
          await assert.rejects(repoA.courseStructure(course.id));
          await db.enrollment.create({
            data: { userId: A.id, courseId: course.id },
          });
          assert.equal((await repoA.courses()).length, 1);
          assert.equal((await repoB.courses()).length, 0);
          await assert.rejects(repoB.courseStructure(course.id));
          await assert.rejects(repoA.courseStructure(await repoA.studentId()));
          assert.equal(
            (await repoA.courseStructure(course.id)).title,
            course.title,
          );
          await db.course.update({
            where: { id: course.id },
            data: { published: false },
          });
          await assert.rejects(repoA.courseStructure(course.id));
          await db.course.update({
            where: { id: course.id },
            data: { published: true },
          });
        },
      );
      await t.test(
        'published sections and mixed item positions order deterministically; lesson subtype is constrained',
        async () => {
          const second = await db.section.create({
            data: {
              courseId: course.id,
              title: 'Second section',
              position: 2,
              published: true,
            },
          });
          const first = await db.section.create({
            data: {
              courseId: course.id,
              title: 'First section',
              position: 1,
              published: true,
            },
          });
          await db.section.create({
            data: { courseId: course.id, title: 'Draft section', position: 3 },
          });
          const lesson = await db.learningItem.create({
            data: {
              sectionId: first.id,
              title: 'Lesson fixture',
              type: 'LESSON',
              position: 1,
              published: true,
            },
          });
          const quiz = await db.learningItem.create({
            data: {
              sectionId: first.id,
              title: 'Quiz fixture',
              type: 'QUIZ',
              position: 3,
              published: true,
            },
          });
          await db.learningItem.create({
            data: {
              sectionId: first.id,
              title: 'Resource fixture',
              type: 'RESOURCE',
              position: 2,
              published: true,
            },
          });
          await db.learningItem.create({
            data: {
              sectionId: first.id,
              title: 'Draft item',
              type: 'ASSESSMENT',
              position: 4,
            },
          });
          await db.lesson.create({
            data: {
              itemId: lesson.id,
              format: 'VIDEO',
              storageKey: 'future-video-key',
            },
          });
          await assert.rejects(
            db.lesson.create({ data: { itemId: quiz.id, format: 'TEXT' } }),
          );
          await assert.rejects(
            db.section.create({
              data: {
                courseId: course.id,
                title: 'duplicate',
                position: first.position,
              },
            }),
          );
          await assert.rejects(
            db.learningItem.create({
              data: {
                sectionId: second.id,
                title: 'negative',
                position: -1,
                type: 'QUIZ',
              },
            }),
          );
          const structure = await repoA.courseStructure(course.id);
          assert.deepEqual(
            structure.sections.map((row) => row.title),
            ['First section', 'Second section'],
          );
          assert.deepEqual(
            structure.sections[0].items.map((row) => row.type),
            ['LESSON', 'RESOURCE', 'QUIZ'],
          );
          assert.doesNotMatch(
            JSON.stringify(structure),
            /future-video-key|studentId|clerkUserId|progress/,
          );
        },
      );
    } finally {
      await isolated.cleanup();
    }
  },
);
test(
  'additive L1 migrations preserve a populated D4 schema and backfill existing students',
  { skip: !live },
  async () => {
    const configured = testDatabaseUrl()!;
    const schema = `d4_${randomBytes(12).toString('hex')}`;
    const url = new URL(configured);
    url.searchParams.set('schema', schema);
    const admin = new Client({ connectionString: configured });
    await admin.connect();
    const connected = await admin.query<{ database: string }>(
      'SELECT current_database() AS database',
    );
    if (
      connected.rows[0]?.database !== decodeURIComponent(url.pathname.slice(1))
    ) {
      await admin.end();
      throw new Error('Test database identity mismatch.');
    }
    const cli = (args: string[]) =>
      execFileSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', ...args],
        {
          env: { ...process.env, DATABASE_URL: url.toString() },
          stdio: 'pipe',
        },
      );
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await admin.query(`SET search_path TO "${schema}"`);
      await admin.query(
        readFileSync(
          'prisma/migrations/20261001000000_student_foundation/migration.sql',
          'utf8',
        ),
      );
      await admin.query(
        `INSERT INTO "User" (id,"clerkUserId","updatedAt") VALUES ('legacy_student','legacy_clerk',now())`,
      );
      await admin.query(
        `INSERT INTO "StudentProfile" ("userId",institution,"updatedAt") VALUES ('legacy_student','Preserved institution',now())`,
      );
      cli([
        'migrate',
        'resolve',
        '--applied',
        '20261001000000_student_foundation',
      ]);
      // Exercise the entitlement migration against a populated, already-issued L1 identity/cohort.
      for (const migration of [
        '20261001005000_instructor_role',
        '20261001010000_lms_foundation',
      ]) {
        await admin.query(
          readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8'),
        );
        cli(['migrate', 'resolve', '--applied', migration]);
      }
      const issued = (
        await admin.query(
          `SELECT "studentId" FROM "User" WHERE id='legacy_student'`,
        )
      ).rows[0].studentId;
      await admin.query(
        `INSERT INTO "Batch" (id,code,name,status,"updatedAt") VALUES ('legacy_batch','LEGACY-26','Preserved cohort','ACTIVE',now())`,
      );
      await admin.query(
        `INSERT INTO "BatchMembership" (id,"batchId","userId","updatedAt") VALUES ('legacy_membership','legacy_batch','legacy_student',now())`,
      );
      await admin.query(
        `INSERT INTO "Course" (id,title,description,"thumbnailPath","thumbnailAlt","publicPath",published,"updatedAt") VALUES ('legacy_course','Preserved course','Preserved curriculum','/images/campus.webp','Campus','/#programs',true,now())`,
      );
      await admin.query(
        `INSERT INTO "Enrollment" (id,"userId","courseId","updatedAt") VALUES ('legacy_enrollment','legacy_student','legacy_course',now())`,
      );
      await admin.query(
        `INSERT INTO "Section" (id,"courseId",title,position,published) VALUES ('legacy_section','legacy_course','Preserved section',1,true)`,
      );
      await admin.query(
        `INSERT INTO "LearningItem" (id,"sectionId",title,type,position,published) VALUES ('legacy_item','legacy_section','Preserved lesson','LESSON',1,true)`,
      );
      await admin.query(
        `INSERT INTO "Lesson" ("itemId",format) VALUES ('legacy_item','TEXT')`,
      );
      cli(['migrate', 'deploy']);
      cli(['migrate', 'deploy']);
      const legacyLesson = (
        await admin.query(
          `SELECT i.title,i.required,l."structuredContent" FROM "LearningItem" i JOIN "Lesson" l ON l."itemId"=i.id WHERE i.id='legacy_item'`,
        )
      ).rows[0];
      assert.equal(legacyLesson.title, 'Preserved lesson');
      assert.equal(legacyLesson.required, true);
      assert.equal(legacyLesson.structuredContent, null);

      assert.equal(
        (
          await admin.query(
            `SELECT "lmsAccessOverride" FROM "User" WHERE id='legacy_student'`,
          )
        ).rows[0].lmsAccessOverride,
        null,
      );
      assert.equal(
        (
          await admin.query(
            `SELECT "lmsAccessEnabled" FROM "Batch" WHERE id='legacy_batch'`,
          )
        ).rows[0].lmsAccessEnabled,
        false,
      );
      assert.equal(
        (
          await admin.query(
            'SELECT count(*)::int AS count FROM "BatchMembership"',
          )
        ).rows[0].count,
        1,
      );

      const rows = (
        await admin.query(
          `SELECT u.id,u."clerkUserId",u."studentId",p.institution FROM "User" u JOIN "StudentProfile" p ON p."userId"=u.id`,
        )
      ).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, 'legacy_student');
      assert.equal(rows[0].clerkUserId, 'legacy_clerk');
      assert.equal(rows[0].institution, 'Preserved institution');
      assert.match(rows[0].studentId, /^MLM-STU-\d{4}-\d{6,}$/);
      assert.equal(rows[0].studentId, issued);
    } finally {
      await admin.query('SET search_path TO public');
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  },
);
