import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isolatedDatabase, testDatabaseUrl } from './helpers/d4-database';
import { provisionUser } from '../src/lib/student/repository';
import { LearningRepository } from '../src/lib/lms/learning';
import {
  safeLessonContent,
  approvedExternalLink,
} from '../src/lib/lms/content';
import {
  lessonProgress,
  learningProjection,
  type OutlineItem,
} from '../src/lib/lms/progress';
import {
  privateFileResponse,
  openPrivateFile,
} from '../src/lib/storage/private-files';
import { learningFixture, fixtureText } from './helpers/l2-fixtures';
import { resolveLearningLaunch } from '../src/lib/dashboard/learning-launch';
import { lmsInternalPath } from '../src/lib/platform/domains';
test('structured content validates typed blocks and rejects HTML/attributes/oversized content', () => {
  assert.ok(safeLessonContent(fixtureText));
  for (const value of [
    {
      version: 1,
      blocks: [{ type: 'html', html: '<script>alert(1)</script>' }],
    },
    {
      version: 1,
      blocks: [{ type: 'paragraph', text: 'safe', onclick: 'evil' }],
    },
    { version: 1, blocks: [{ type: 'paragraph', text: 'a'.repeat(12001) }] },
  ])
    assert.equal(safeLessonContent(value), null);
  assert.equal(
    approvedExternalLink('bad', {
      links: { bad: 'javascript:alert(1)' },
      origins: ['javascript:'],
    }),
    null,
  );
  assert.equal(
    approvedExternalLink('known', {
      links: { known: 'https://approved.test/course' },
      origins: ['https://approved.test'],
    }),
    'https://approved.test/course',
  );
  assert.equal(
    approvedExternalLink('known', {
      links: { known: 'https://evil.test/course' },
      origins: ['https://approved.test'],
    }),
    null,
  );
});
test('progress excludes optional, absent lesson metadata and future types; next selection is deterministic', () => {
  const item: OutlineItem = {
    id: 'a',
    title: 'A',
    type: 'LESSON',
    required: true,
    lesson: { format: 'TEXT' },
    completedAt: null,
    lastAccessedAt: null,
  };
  assert.equal(lessonProgress([]).percentage, null);
  assert.deepEqual(
    lessonProgress([
      item,
      { ...item, id: 'optional', required: false },
      { ...item, type: 'QUIZ', completedAt: '2026-01-01' },
    ]),
    { requiredItems: 1, completedItems: 0, percentage: 0 },
  );
  const sections = [
    {
      title: 'One',
      position: 1,
      items: [item, { ...item, id: 'b', lastAccessedAt: '2026-01-01' }],
    },
  ];
  assert.equal(learningProjection(sections).nextLesson?.id, 'b');
  sections[0].items[1].completedAt = '2026-01-01';
  assert.equal(learningProjection(sections).nextLesson?.id, 'a');
  sections[0].items[0].completedAt = '2026-01-01';
  assert.equal(learningProjection(sections).nextLesson, null);
  assert.equal(
    resolveLearningLaunch({
      destinationId: 'lms-course-courseA',
      lessonId: 'lessonB',
    }),
    '/learn/courses/courseA/lessons/lessonB',
  );
  assert.equal(
    lmsInternalPath('/courses/courseA/lessons/lessonB'),
    '/learn/courses/courseA/lessons/lessonB',
  );
});
test('private delivery validates MIME, ranges, download permission and traversal without exposing paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mentoralm-l2-files-'));
  try {
    await writeFile(join(root, 'fixture.pdf'), '%PDF-1.4\nfixture data');
    await writeFile(join(root, 'bad.png'), '<script>unsafe</script>');
    await symlink('/etc/hosts', join(root, 'escape.txt'));
    const record = {
      storageKey: 'fixture.pdf',
      mimeType: 'application/pdf',
      fileName: 'safe.pdf',
      downloadAllowed: false,
    };
    const response = await privateFileResponse(
      new Request('http://local.test/media', {
        headers: { Range: 'bytes=0-4' },
      }),
      record,
      root,
    );
    assert.equal(response.status, 206);
    assert.equal(await response.text(), '%PDF-');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(
      (
        await privateFileResponse(
          new Request('http://local.test/media', {
            headers: { Range: 'bytes=999-1000' },
          }),
          record,
          root,
        )
      ).status,
      416,
    );
    await assert.rejects(
      privateFileResponse(
        new Request('http://local.test/media?download=1'),
        record,
        root,
      ),
    );
    await assert.rejects(openPrivateFile(root, '../fixture.pdf', 100));
    await assert.rejects(openPrivateFile(root, 'escape.txt', 10000));
    await assert.rejects(
      privateFileResponse(
        new Request('http://local.test/media'),
        { ...record, storageKey: 'bad.png', mimeType: 'image/png' },
        root,
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test(
  'PostgreSQL learning authorization, state, concurrency, progress and revocation',
  { skip: !testDatabaseUrl() },
  async (t) => {
    const isolated = await isolatedDatabase(),
      db = isolated.db;
    const root = await mkdtemp(join(tmpdir(), 'mentoralm-l2-media-'));
    const old = process.env.LMS_FILES_ROOT;
    process.env.LMS_FILES_ROOT = root;
    try {
      await writeFile(join(root, 'lesson.pdf'), '%PDF-1.4\nfixture');
      await copyFile('public/favicon.png', join(root, 'lesson.png'));
      await writeFile(
        join(root, 'lesson.webm'),
        Buffer.from([26, 69, 223, 163, 0, 0, 0, 0]),
      );
      const A = await provisionUser(db, 'l2_A'),
        B = await provisionUser(db, 'l2_B');
      const f = await learningFixture(db, A.id, 'domain'),
        repo = new LearningRepository(db, A),
        other = new LearningRepository(db, B);
      await t.test(
        'entitlement then enrollment, publication and actual lesson relationship are mandatory',
        async () => {
          await assert.rejects(repo.lesson(f.course.id, f.first.id), {
            code: 'FORBIDDEN',
          });
          await db.user.updateMany({
            where: { id: { in: [A.id, B.id] } },
            data: { lmsAccessOverride: 'ENABLED' },
          });
          await assert.rejects(other.lesson(f.course.id, f.first.id), {
            code: 'NOT_FOUND',
          });
          await assert.rejects(repo.lesson(f.course.id, f.draft.id), {
            code: 'NOT_FOUND',
          });
          await assert.rejects(repo.record(f.course.id, f.quiz.id, true), {
            code: 'NOT_FOUND',
          });
          await assert.rejects(repo.lesson('unrelated', f.first.id));
          await db.section.update({
            where: { id: f.section.id },
            data: { published: false },
          });
          await assert.rejects(repo.lesson(f.course.id, f.first.id));
          await db.section.update({
            where: { id: f.section.id },
            data: { published: true },
          });
          assert.ok((await repo.lesson(f.course.id, f.first.id)).content);
          assert.equal((await other.dashboardSummaries()).length, 0);
        },
      );
      await t.test(
        'repeated/concurrent access and completion are unique, immutable and do not complete enrollment',
        async () => {
          await Promise.all(
            Array.from({ length: 8 }, () =>
              repo.record(f.course.id, f.first.id, false),
            ),
          );
          const before = await db.lessonState.findUniqueOrThrow({
            where: { userId_itemId: { userId: A.id, itemId: f.first.id } },
          });
          await Promise.all(
            Array.from({ length: 12 }, () =>
              repo.record(f.course.id, f.first.id, true),
            ),
          );
          const first = await db.lessonState.findUniqueOrThrow({
            where: { userId_itemId: { userId: A.id, itemId: f.first.id } },
          });
          await repo.record(f.course.id, f.first.id, true);
          assert.equal(
            (
              await db.lessonState.findUniqueOrThrow({
                where: { userId_itemId: { userId: A.id, itemId: f.first.id } },
              })
            ).completedAt?.toISOString(),
            first.completedAt?.toISOString(),
          );
          assert.equal(
            first.firstAccessedAt.toISOString(),
            before.firstAccessedAt.toISOString(),
          );
          assert.equal(
            await db.lessonState.count({
              where: { userId: A.id, itemId: f.first.id },
            }),
            1,
          );
          assert.equal(
            (
              await db.enrollment.findUniqueOrThrow({
                where: {
                  userId_courseId: { userId: A.id, courseId: f.course.id },
                },
              })
            ).status,
            'ENROLLED',
          );
          assert.equal(
            (await repo.course(f.course.id)).progress.percentage,
            25,
          );
          assert.equal(
            (await repo.course(f.course.id)).sections[0].progress.percentage,
            50,
          );
          await repo.record(f.course.id, f.image.id, true);
          assert.equal(
            (await repo.course(f.course.id)).progress.percentage,
            25,
          );
          await repo.record(f.course.id, f.next.id, false);
          assert.equal(
            (await repo.course(f.course.id)).progress.nextLesson?.id,
            f.next.id,
          );
          assert.equal(
            await db.lessonState.count({ where: { userId: B.id } }),
            0,
          );
        },
      );
      await t.test(
        'two enrolled students have independent progress/access state and curriculum changes recalculate totals',
        async () => {
          await db.enrollment.create({
            data: { userId: B.id, courseId: f.course.id },
          });
          assert.equal(
            (await other.course(f.course.id)).progress.percentage,
            0,
          );
          assert.equal(
            (await other.course(f.course.id)).progress.lastAccessedAt,
            null,
          );
          await other.record(f.course.id, f.first.id, false);
          assert.equal(
            (await other.lesson(f.course.id, f.first.id)).completed,
            false,
          );
          assert.equal(
            (await repo.course(f.course.id)).progress.percentage,
            25,
          );
          await db.learningItem.update({
            where: { id: f.first.id },
            data: { published: false },
          });
          assert.equal(
            (await repo.course(f.course.id)).progress.requiredItems,
            3,
          );
          assert.equal((await repo.course(f.course.id)).progress.percentage, 0);
          await db.learningItem.update({
            where: { id: f.first.id },
            data: { published: true },
          });
          await db.enrollment.delete({
            where: { userId_courseId: { userId: B.id, courseId: f.course.id } },
          });
        },
      );
      await t.test(
        'LMS resources are scoped separately and media metadata never enters student projections',
        async () => {
          assert.equal((await repo.resources()).length, 1);
          assert.equal((await other.resources()).length, 0);
          await assert.rejects(other.resourceMedia(f.course.id, f.resource.id));
          assert.ok(await repo.media(f.course.id, f.video.id));
          assert.ok(await repo.media(f.course.id, f.pdf.id));
          assert.equal(
            (await repo.lesson(f.course.id, f.external.id)).external,
            null,
          );
          assert.doesNotMatch(
            JSON.stringify(await repo.course(f.course.id)),
            /storageKey|clerkUserId|userId|structuredContent/,
          );
          assert.doesNotMatch(
            JSON.stringify(await repo.resources()),
            /storageKey|userId/,
          );
          await assert.rejects(
            db.learningResource.create({
              data: {
                itemId: f.first.id,
                itemType: 'LESSON',
                mimeType: 'text/plain',
                fileName: 'bad.txt',
              },
            }),
          );
        },
      );
      await t.test(
        'revocation stops subsequent content, media, completion, access, resources and Dashboard projection',
        async () => {
          await db.user.update({
            where: { id: A.id },
            data: { lmsAccessOverride: 'DISABLED' },
          });
          for (const operation of [
            () => repo.lesson(f.course.id, f.first.id),
            () => repo.media(f.course.id, f.video.id),
            () => repo.record(f.course.id, f.first.id, false),
            () => repo.record(f.course.id, f.first.id, true),
            () => repo.resources(),
          ])
            await assert.rejects(operation(), { code: 'FORBIDDEN' });
          assert.equal((await repo.dashboardSummaries()).length, 0);
          await db.user.update({
            where: { id: A.id },
            data: { lmsAccessOverride: 'ENABLED' },
          });
          await db.enrollment.delete({
            where: { userId_courseId: { userId: A.id, courseId: f.course.id } },
          });
          await assert.rejects(repo.record(f.course.id, f.first.id, true), {
            code: 'NOT_FOUND',
          });
          await assert.rejects(repo.media(f.course.id, f.video.id), {
            code: 'NOT_FOUND',
          });
          assert.equal((await repo.dashboardSummaries()).length, 0);
        },
      );
    } finally {
      if (old === undefined) delete process.env.LMS_FILES_ROOT;
      else process.env.LMS_FILES_ROOT = old;
      await isolated.cleanup();
      await rm(root, { recursive: true, force: true });
    }
  },
);
