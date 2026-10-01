import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { databaseUrl, referralOrigin } from '../src/lib/db/config';
import {
  profileInput,
  ticketInput,
  replyInput,
  viewInput,
  referralInput,
} from '../src/lib/student/validation';
import {
  StudentRepository,
  provisionUser,
} from '../src/lib/student/repository';
import {
  readResourceFile,
  validatePreviewContent,
} from '../src/lib/student/files';
import { requestBody, studentResponse } from '../src/lib/student/http';
import { isolatedDatabase, testDatabaseUrl } from './helpers/d4-database';
const profile = {
  educationLevel: 'Graduate',
  institution: 'Test university',
  graduationYear: 2027,
  interests: ['Design'],
  careerGoals: 'Build useful products',
};
const ticket = {
  category: 'Technical',
  subject: 'Test support',
  message: 'Please help with this test issue.',
};

test('configuration validates protocols and trusted referral origin', () => {
  assert.throws(() => databaseUrl('https://invalid.test'));
  assert.throws(() => databaseUrl(''));
  assert.equal(referralOrigin('http://unsafe.test'), null);
  assert.equal(referralOrigin('https://valid.test/path'), null);
  assert.equal(referralOrigin('https://valid.test'), 'https://valid.test');
});
test('strict mutations reject role, owner, staff, publication, HTML and length abuses', () => {
  assert.equal(profileInput.safeParse(profile).success, true);
  for (const field of ['role', 'userId', 'id', 'published', 'clerkUserId'])
    assert.equal(
      profileInput.safeParse({ ...profile, [field]: 'ADMIN' }).success,
      false,
    );
  assert.equal(
    replyInput.safeParse({ message: 'hello', actor: 'STAFF' }).success,
    false,
  );
  assert.equal(
    replyInput.safeParse({ message: '<script>alert(1)</script>' }).success,
    false,
  );
  assert.equal(
    replyInput.safeParse({ message: 'a'.repeat(4001) }).success,
    false,
  );
  assert.equal(
    ticketInput.safeParse({ ...ticket, category: 'invented' }).success,
    false,
  );
  assert.equal(
    viewInput.safeParse({ courseId: 'course', userId: 'other' }).success,
    false,
  );
  assert.equal(referralInput.safeParse({ code: 'short' }).success, false);
});
test('HTTP mutation boundary rejects cross-origin, wrong content type and oversized JSON', async () => {
  const request = (origin: string, data: string, type = 'application/json') =>
    new Request('https://mentoralm.test/api/student/profile', {
      method: 'PATCH',
      headers: { origin, 'content-type': type },
      body: data,
    });
  await assert.rejects(requestBody(request('https://attacker.test', '{}')));
  await assert.rejects(
    requestBody(request('https://mentoralm.test', '{}', 'text/plain')),
  );
  await assert.rejects(
    requestBody(
      request(
        'https://mentoralm.test',
        JSON.stringify({ message: 'a'.repeat(17000) }),
      ),
    ),
  );
  assert.deepEqual(
    await requestBody(request('https://mentoralm.test', '{"ok":true}')),
    { ok: true },
  );
});
test('private errors never disclose database details', async () => {
  const response = await studentResponse(async () => {
    throw new Error('secret SQL host and password');
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.doesNotMatch(await response.text(), /SQL|password|host/);
});
test('controlled resource provider reads fixture and rejects traversal, URLs and escaping symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mentoralm-d4-files-'));
  const outside = await mkdtemp(join(tmpdir(), 'mentoralm-d4-outside-'));
  const previous = process.env.RESOURCE_FILES_ROOT;
  process.env.RESOURCE_FILES_ROOT = root;
  try {
    await writeFile(join(root, 'fixture.txt'), 'Authorized fixture');
    await writeFile(join(outside, 'outside.txt'), 'private');
    await symlink(join(outside, 'outside.txt'), join(root, 'escape.txt'));
    assert.equal(
      (await readResourceFile('fixture.txt')).toString(),
      'Authorized fixture',
    );
    for (const key of [
      '../outside.txt',
      '/etc/passwd',
      'https://unsafe.test/file.txt',
      'escape.txt',
    ])
      await assert.rejects(readResourceFile(key));
  } finally {
    if (previous === undefined) delete process.env.RESOURCE_FILES_ROOT;
    else process.env.RESOURCE_FILES_ROOT = previous;
    await Promise.all([
      rm(root, { recursive: true }),
      rm(outside, { recursive: true }),
    ]);
  }
});
test(
  'PostgreSQL migrations, ownership and domain invariants',
  {
    skip: !testDatabaseUrl()
      ? 'TEST_DATABASE_URL missing: live PostgreSQL verification not performed.'
      : false,
  },
  async (t) => {
    const isolated = await isolatedDatabase();
    const db = isolated.db;
    try {
      await t.test(
        'clean migration records completion and seven SQL invariants',
        async () => {
          const migrations = await db.$queryRawUnsafe<
            Array<{
              migration_name: string;
              finished_at: Date | null;
              rolled_back_at: Date | null;
            }>
          >(
            `SELECT migration_name, finished_at, rolled_back_at FROM "${isolated.schema}"."_prisma_migrations"`,
          );
          assert.equal(migrations.length, 5);
          assert.ok(
            migrations.some(
              (row) =>
                row.migration_name === '20261001000000_student_foundation',
            ),
          );
          assert.ok(
            migrations.every(
              (row) => row.finished_at && row.rolled_back_at === null,
            ),
          );
          assert.ok(migrations[0].finished_at);
          assert.equal(migrations[0].rolled_back_at, null);
          const checks = await db.$queryRaw<
            Array<{ count: bigint }>
          >`SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema = ${isolated.schema} AND constraint_type = 'CHECK' AND constraint_name IN ('referral_no_self','profile_year_bounds','resource_size_nonnegative','resource_audience_relationship','ticket_category','ticket_subject_length','message_body_length')`;
          assert.equal(Number(checks[0].count), 7);
        },
      );
      let a!: Awaited<ReturnType<typeof provisionUser>>;
      let b!: typeof a;
      let c!: typeof a;
      await t.test(
        'concurrent lazy provisioning maps one Clerk identity to one STUDENT',
        async () => {
          const rows = await Promise.all(
            Array.from({ length: 8 }, () => provisionUser(db, 'd4_clerk_a')),
          );
          assert.equal(new Set(rows.map((row) => row.id)).size, 1);
          a = rows[0];
          assert.equal(a.role, 'STUDENT');
          b = await provisionUser(db, 'd4_clerk_b');
          c = await provisionUser(db, 'd4_clerk_c');
        },
      );
      const A = new StudentRepository(db, a),
        B = new StudentRepository(db, b),
        C = new StudentRepository(db, c);
      await t.test(
        'own profile persists; mass assignment cannot change ownership or role',
        async () => {
          assert.equal(await A.profile(), null);
          await A.updateProfile(profile);
          assert.deepEqual(await A.profile(), profile);
          assert.equal(await B.profile(), null);
          await assert.rejects(
            A.updateProfile({ ...profile, userId: b.id, role: 'ADMIN' }),
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: a.id } })).role,
            'STUDENT',
          );
        },
      );
      const program = await db.program.create({
        data: { title: 'Isolated program' },
      });
      const course = await db.course.create({
        data: {
          title: 'Isolated course',
          description: 'Fixture',
          thumbnailPath: '/images/campus.webp',
          thumbnailAlt: 'Test course',
          publicPath: '/#programs',
          published: true,
          programId: program.id,
        },
      });
      const unpublished = await db.course.create({
        data: {
          title: 'Unpublished',
          description: 'Fixture',
          thumbnailPath: '/images/campus.webp',
          thumbnailAlt: 'Test course',
          publicPath: '/#programs',
        },
      });
      await t.test(
        'views upsert; enrollments and course history remain owner scoped',
        async () => {
          await Promise.all(
            Array.from({ length: 5 }, () =>
              A.recordView({ courseId: course.id }),
            ),
          );
          await assert.rejects(A.recordView({ courseId: unpublished.id }));
          await db.enrollment.create({
            data: { userId: a.id, courseId: course.id },
          });
          assert.equal((await A.courses()).views.length, 1);
          assert.equal((await A.courses()).enrollments.length, 1);
          assert.deepEqual(await B.courses(), { views: [], enrollments: [] });
          await assert.rejects(
            db.enrollment.create({
              data: { userId: a.id, courseId: course.id },
            }),
          );
        },
      );
      const resource = (
        audience: 'PRIVATE' | 'STUDENTS' | 'COURSE' | 'PROGRAM',
        published = true,
      ) =>
        db.resource.create({
          data: {
            title: audience,
            description: 'Fixture',
            category: 'DOCUMENTS',
            mimeType: 'application/pdf',
            fileName: 'fixture.pdf',
            audience,
            published,
            ...(audience === 'COURSE' ? { courseId: course.id } : {}),
            ...(audience === 'PROGRAM' ? { programId: program.id } : {}),
          },
        });
      await t.test(
        'published global, assigned, course and program access; private IDOR denied',
        async () => {
          const privateFile = await resource('PRIVATE');
          await db.resourceAssignment.create({
            data: { userId: a.id, resourceId: privateFile.id },
          });
          await resource('STUDENTS');
          await resource('COURSE');
          await resource('PROGRAM');
          await resource('STUDENTS', false);
          assert.equal((await A.resources()).length, 4);
          assert.equal((await B.resources()).length, 1);
          await assert.rejects(B.resource(privateFile.id));
          assert.equal((await A.resource(privateFile.id)).id, privateFile.id);
        },
      );
      await t.test(
        'ticket and reply persist; cross-student read/reply and staff injection fail',
        async () => {
          const created = await A.createTicket(ticket);
          assert.equal((await A.tickets()).length, 1);
          assert.equal((await B.tickets()).length, 0);
          await A.reply(created.id, { message: 'Follow up' });
          const detail = await A.ticket(created.id);
          assert.equal(detail.messages.length, 2);
          assert.equal(detail.messages[1].actor, 'STUDENT');
          await assert.rejects(B.ticket(created.id));
          await assert.rejects(B.reply(created.id, { message: 'attack' }));
          await assert.rejects(
            A.reply(created.id, { message: 'attack', actor: 'STAFF' }),
          );
          await db.supportTicket.update({
            where: { id: created.id },
            data: { status: 'CLOSED' },
          });
          await assert.rejects(A.reply(created.id, { message: 'closed' }));
        },
      );
      await t.test(
        'random unique referral identity; self, duplicate and referrer change rules',
        async () => {
          const first = await A.referral();
          const second = await B.referral();
          assert.notEqual(first.identity.code, second.identity.code);
          assert.match(first.identity.code, /^[a-zA-Z0-9_-]{32}$/);
          assert.equal((await A.referral()).identity.code, first.identity.code);
          await assert.rejects(
            A.attributeReferral({ code: first.identity.code }),
          );
          await Promise.all(
            Array.from({ length: 4 }, () =>
              C.attributeReferral({ code: first.identity.code }),
            ),
          );
          assert.equal((await A.referral()).history.length, 1);
          assert.equal((await B.referral()).history.length, 0);
          await assert.rejects(
            C.attributeReferral({ code: second.identity.code }),
          );
          await assert.rejects(
            db.referralAttribution.create({
              data: { referredUserId: b.id, referrerId: b.id },
            }),
          );
        },
      );
    } finally {
      await isolated.cleanup();
    }
  },
);

test('resource preview rejects active MIME and mismatched file signatures', () => {
  assert.throws(() =>
    validatePreviewContent(Buffer.from('<svg/>'), 'image/svg+xml'),
  );
  assert.throws(() =>
    validatePreviewContent(
      Buffer.from('<html>attack</html>'),
      'application/pdf',
    ),
  );
  assert.doesNotThrow(() =>
    validatePreviewContent(
      Buffer.from('%PDF-1.7 test fixture'),
      'application/pdf',
    ),
  );
});

test('test guard denies development URL, aliases, remote hosts and missing opt-in before connecting', () => {
  const saved = {
    DATABASE_URL: process.env.DATABASE_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    ALLOW_DATABASE_TESTS: process.env.ALLOW_DATABASE_TESTS,
  };
  try {
    process.env.ALLOW_DATABASE_TESTS = '1';
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
    assert.throws(() => testDatabaseUrl(), /dedicated database/);
    process.env.DATABASE_URL = 'postgresql://localhost/guard_test';
    process.env.TEST_DATABASE_URL = 'postgresql://127.0.0.1:5432/guard_test';
    assert.throws(() => testDatabaseUrl(), /must be separate/);
    process.env.TEST_DATABASE_URL =
      'postgresql://production.example/mentoralm_test';
    assert.throws(() => testDatabaseUrl(), /restricted to local/);
    process.env.TEST_DATABASE_URL = 'postgresql://localhost/mentoralm_test';
    process.env.ALLOW_DATABASE_TESTS = '0';
    assert.throws(() => testDatabaseUrl(), /ALLOW_DATABASE_TESTS/);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
