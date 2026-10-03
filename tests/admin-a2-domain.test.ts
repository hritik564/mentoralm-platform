import { legacyAdminPermissions } from '../src/lib/admin/permissions';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase } from './helpers/d4-database';
import { AcademicAuthoring } from '../src/lib/admin/academic/authoring';
import { AcademicMedia } from '../src/lib/admin/academic/media';
import { AdminOperations } from '../src/lib/admin/operations';
import { LearningRepository } from '../src/lib/lms/learning';
import { Attempts } from '../src/lib/lms/attempts';
import { Assignments } from '../src/lib/lms/assignments';
import { adminHandle, adminId } from '../src/lib/admin/handles';
import {
  courseInput,
  questionInput,
} from '../src/lib/admin/academic/validation';
import { parseInput } from '../src/lib/admin/validation';
import { adminDestination } from '../src/lib/platform/domains';
const courseData = {
  title: 'A2 course',
  description: 'Academic skills',
  programId: null,
  thumbnailPath: '/images/campus.webp' as const,
  thumbnailAlt: 'Campus',
  publicPath: '/#programs' as const,
  published: false,
  academicCompletionEnabled: false,
  certificateEnabled: false,
  requiredAttendancePercent: null,
};
const assignmentData = {
  instructions: 'Explain your learning.',
  dueAt: null,
  allowedKinds: ['TEXT'],
  maxFiles: 3,
  maxFileBytes: 5242880,
  requiresAcceptance: true,
  allowResubmission: true,
};
const activityData = {
  instructions: 'Answer each question.',
  passingPercent: 70,
  attemptLimit: 3,
  reviewAnswers: false,
};
test('A2 strict inputs and opaque route/context boundaries', () => {
  assert.throws(() =>
    parseInput(courseInput, { ...courseData, actorId: 'admin' }),
  );
  for (const q of [
    {
      type: 'SINGLE_CHOICE',
      options: [
        { label: 'A', correct: true },
        { label: 'B', correct: true },
      ],
    },
    {
      type: 'MULTIPLE_CHOICE',
      options: [
        { label: 'A', correct: false },
        { label: 'B', correct: false },
      ],
    },
    {
      type: 'TRUE_FALSE',
      options: [
        { label: 'Yes', correct: true },
        { label: 'No', correct: false },
      ],
    },
    { type: 'SHORT_TEXT', options: [{ label: 'Semantic AI', correct: true }] },
  ])
    assert.throws(() =>
      parseInput(questionInput, {
        ...q,
        prompt: 'Prompt',
        explanation: null,
        published: true,
      }),
    );
  const section = adminHandle('section', 'private_section');
  assert.equal(adminId('section', section), 'private_section');
  assert.throws(() => adminId('question', section));
  assert.throws(() => adminId('section', 'guessed_database_id'));
  assert.equal(
    adminDestination('/admin/courses/opaque_course'),
    '/admin/courses/opaque_course',
  );
  assert.equal(adminDestination('/admin/courses/x/../../students'), '/admin');
});
test('A2 persisted academic authoring, publication, immutable history and private media', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db,
    root = await mkdtemp(join(tmpdir(), 'mentoralm-a2-')),
    savedRoot = process.env.LMS_FILES_ROOT,
    savedLinks = process.env.LMS_EXTERNAL_LINKS,
    savedOrigins = process.env.LMS_EXTERNAL_ORIGINS;
  process.env.LMS_FILES_ROOT = root;
  process.env.LMS_EXTERNAL_LINKS = JSON.stringify({
    approved: 'https://learning.example.test/session',
  });
  process.env.LMS_EXTERNAL_ORIGINS = 'https://learning.example.test';
  try {
    const admin = await db.user.create({
      data: { clerkUserId: 'a2_admin', role: 'STUDENT' },
    });
    await db.userRoleAssignment.create({
      data: { userId: admin.id, role: 'ADMIN' },
    });
    await db.adminAuthorization.create({
      data: { userId: admin.id, permissions: legacyAdminPermissions },
    });
    const student = await db.user.create({
        data: { clerkUserId: 'a2_student', lmsAccessOverride: 'ENABLED' },
      }),
      outsider = await db.user.create({
        data: { clerkUserId: 'a2_outsider', lmsAccessOverride: 'ENABLED' },
      });
    const r = new AcademicAuthoring(db, admin.id),
      denied = new AcademicAuthoring(db, student.id),
      learning = new LearningRepository(db, student),
      media = new AcademicMedia(db, admin.id);
    const program = await r.saveProgram(null, { title: 'Academic Program' }),
      course = await r.saveCourse(null, { ...courseData, programId: program }),
      section = await r.saveSection(course, null, {
        title: 'Foundations',
        description: null,
        published: false,
      });
    const ids: Record<string, string> = {};
    for (const type of [
      'LESSON',
      'QUIZ',
      'ASSESSMENT',
      'ASSIGNMENT',
      'RESOURCE',
      'LIVE_SESSION',
    ] as const)
      ids[type] = await r.saveItem(course, section, null, {
        title: type,
        type,
        required: true,
        published: false,
      });
    await db.enrollment.create({
      data: { userId: student.id, courseId: course },
    });
    await t.test(
      'Programs/Courses supported metadata, filtering, no synthetic publication or enrollment writes',
      async () => {
        assert.equal((await r.programs()).total, 1);
        assert.equal((await r.courses({ program, status: 'DRAFT' })).total, 1);
        await r.saveProgram(program, { title: 'Renamed Academic Program' });
        await r.saveCourse(course, {
          ...courseData,
          title: 'Revised title',
          programId: program,
        });
        assert.equal(await db.enrollment.count(), 1);
        await assert.rejects(
          r.saveCourse(course, {
            ...courseData,
            programId: program,
            academicCompletionEnabled: true,
          }),
          { code: 'CONFLICT' },
        );
      },
    );
    await t.test(
      'Every read/write requires effective persisted ADMIN',
      async () => {
        for (const work of [
          () => denied.programs(),
          () => denied.courses(),
          () => denied.builder(course),
          () => denied.bank('missing'),
          () => denied.saveProgram(null, { title: 'Attack' }),
          () => denied.saveCourse(null, courseData),
          () =>
            denied.saveSection(course, null, {
              title: 'Attack',
              description: null,
              published: false,
            }),
          () =>
            denied.saveLesson(course, section, ids.LESSON, {
              format: 'TEXT',
              structuredContent: {
                version: 1,
                blocks: [{ type: 'paragraph', text: 'Attack' }],
              },
              durationSeconds: null,
            }),
          () => denied.saveBank(null, { title: 'Attack' }),
        ])
          await assert.rejects(work, { code: 'FORBIDDEN' });
      },
    );
    await t.test(
      'Invalid parents, type changes and mismatched handles fail closed',
      async () => {
        const other = await r.saveCourse(null, {
          ...courseData,
          title: 'Other Course',
        });
        await assert.rejects(
          r.saveItem(other, section, null, {
            title: 'Wrong',
            type: 'LESSON',
            required: true,
            published: false,
          }),
          { code: 'NOT_FOUND' },
        );
        await assert.rejects(
          r.saveItem(course, section, ids.LESSON, {
            title: 'Wrong',
            type: 'QUIZ',
            required: true,
            published: false,
          }),
          { code: 'CONFLICT' },
        );
        await assert.rejects(r.item(other, section, ids.LESSON), {
          code: 'NOT_FOUND',
        });
      },
    );
    await t.test(
      'Positive unique section/item ordering survives concurrent swaps',
      async () => {
        const second = await r.saveSection(course, null, {
          title: 'Practice',
          description: null,
          published: false,
        });
        await r.order(course, null, second, { direction: 'UP' });
        assert.equal(
          (await r.builder(course)).sections[0].ref,
          adminHandle('section', second),
        );
        await r.order(course, null, second, { direction: 'DOWN' });
        await Promise.all([
          r.order(course, section, ids.LESSON, { direction: 'DOWN' }),
          r.order(course, section, ids.QUIZ, { direction: 'DOWN' }),
        ]);
        const positions = (
          await db.learningItem.findMany({ where: { sectionId: section } })
        ).map((i) => i.position);
        assert.equal(new Set(positions).size, 6);
        assert.ok(positions.every((p) => p > 0));
      },
    );
    await t.test(
      'Structured lesson blocks supported; arbitrary HTML/iframe and unsafe external rejected',
      async () => {
        await assert.rejects(
          r.saveLesson(course, section, ids.LESSON, {
            format: 'TEXT',
            structuredContent: '<iframe src="evil">',
            durationSeconds: null,
          }),
          { code: 'INVALID_INPUT' },
        );
        await assert.rejects(
          r.saveLesson(course, section, ids.LESSON, {
            format: 'TEXT',
            structuredContent: {
              version: 1,
              blocks: [
                { type: 'paragraph', text: '<script>alert(1)</script>' },
              ],
            },
            durationSeconds: null,
          }),
          { code: 'INVALID_INPUT' },
        );
        await assert.rejects(
          r.saveLesson(course, section, ids.LESSON, {
            format: 'EXTERNAL',
            externalTargetId: 'https://evil.test',
          }),
          { code: 'INVALID_INPUT' },
        );
        await r.saveLesson(course, section, ids.LESSON, {
          format: 'TEXT',
          structuredContent: {
            version: 1,
            blocks: [
              { type: 'heading', level: 2, text: 'Foundations' },
              { type: 'paragraph', text: 'Welcome' },
              { type: 'list', items: ['Learn', 'Practice'], ordered: true },
              { type: 'callout', text: 'Reflect' },
              { type: 'code', text: 'if (x < 2) return;' },
              { type: 'divider' },
            ],
          },
          durationSeconds: null,
        });
      },
    );
    await t.test(
      'Question types/correct answers validate; banks and reusable questions are persisted',
      async () => {
        const bank = await r.saveBank(null, { title: 'Academic Questions' });
        ids.BANK = bank;
        ids.SINGLE = await r.saveQuestion(bank, null, {
          type: 'SINGLE_CHOICE',
          prompt: 'Choose A',
          explanation: null,
          published: true,
          options: [
            { label: 'A', correct: true },
            { label: 'B', correct: false },
          ],
        });
        ids.MULTI = await r.saveQuestion(bank, null, {
          type: 'MULTIPLE_CHOICE',
          prompt: 'Choose A and B',
          explanation: null,
          published: true,
          options: [
            { label: 'A', correct: true },
            { label: 'B', correct: true },
            { label: 'C', correct: false },
          ],
        });
        ids.TRUE = await r.saveQuestion(bank, null, {
          type: 'TRUE_FALSE',
          prompt: 'True?',
          explanation: null,
          published: true,
          options: [
            { label: 'True', correct: true },
            { label: 'False', correct: false },
          ],
        });
        ids.SHORT = await r.saveQuestion(bank, null, {
          type: 'SHORT_TEXT',
          prompt: 'Reflect briefly',
          explanation: null,
          published: true,
          options: [],
        });
        await r.saveQuestion(bank, null, {
          type: 'LONG_TEXT',
          prompt: 'Reflect fully',
          explanation: null,
          published: false,
          options: [],
        });
        assert.equal((await r.bank(bank)).total, 5);
        await assert.rejects(
          denied.saveQuestion(bank, null, {
            type: 'SHORT_TEXT',
            prompt: 'Attack',
            explanation: null,
            published: true,
            options: [],
          }),
          { code: 'FORBIDDEN' },
        );
      },
    );
    await t.test(
      'Quiz and Assessment stay distinct; draft course/items are unavailable',
      async () => {
        await r.saveActivity(course, section, ids.QUIZ, {
          ...activityData,
          questions: [
            { questionId: ids.SINGLE, points: 1 },
            { questionId: ids.MULTI, points: 2 },
            { questionId: ids.TRUE, points: 1 },
          ],
        });
        await r.saveActivity(course, section, ids.ASSESSMENT, {
          ...activityData,
          passingPercent: null,
          questions: [{ questionId: ids.SHORT, points: 1 }],
        });
        await r.saveAssignment(course, section, ids.ASSIGNMENT, assignmentData);
        await assert.rejects(learning.course(course), { code: 'NOT_FOUND' });
        await assert.rejects(
          new Attempts(db, student.id).start(course, ids.QUIZ),
          { code: 'NOT_FOUND' },
        );
        await assert.rejects(
          r.saveItem(course, section, ids.RESOURCE, {
            title: 'RESOURCE',
            type: 'RESOURCE',
            required: true,
            published: true,
          }),
          { code: 'INVALID_INPUT' },
        );
      },
    );
    await t.test(
      'PDF/image/video/external formats reuse signature/MIME/private delivery gates',
      async () => {
        for (const [format, mime, bytes] of [
          ['PDF', 'application/pdf', Buffer.from('%PDF-1.7 fixture')],
          [
            'IMAGE',
            'image/png',
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]),
          ],
          [
            'VIDEO',
            'video/mp4',
            Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50]),
          ],
        ] as const) {
          const id = await r.saveItem(course, section, null, {
            title: format,
            type: 'LESSON',
            required: false,
            published: false,
          });
          ids[format] = id;
          await r.saveLesson(course, section, id, {
            format,
            altText: format === 'IMAGE' ? 'Illustration' : null,
            downloadAllowed: false,
            durationSeconds: null,
          });
          await media.attach(
            course,
            section,
            id,
            new File([bytes], `lesson.${format.toLowerCase()}`, { type: mime }),
          );
          await r.saveItem(course, section, id, {
            title: format,
            type: 'LESSON',
            required: false,
            published: true,
          });
        }
        const external = await r.saveItem(course, section, null, {
          title: 'Approved destination',
          type: 'LESSON',
          required: false,
          published: false,
        });
        await r.saveLesson(course, section, external, {
          format: 'EXTERNAL',
          externalTargetId: 'approved',
        });
        await r.saveItem(course, section, external, {
          title: 'Approved destination',
          type: 'LESSON',
          required: false,
          published: true,
        });
        await assert.rejects(
          media.attach(
            course,
            section,
            ids.RESOURCE,
            new File(['wrong'], 'file.pdf', { type: 'application/pdf' }),
          ),
          { code: 'NOT_FOUND' },
        );
        await assert.rejects(
          media.attach(
            course,
            section,
            ids.RESOURCE,
            new File(['video'], 'file.mp4', { type: 'video/mp4' }),
          ),
          { code: 'INVALID_INPUT' },
        );
        await media.attach(
          course,
          section,
          ids.RESOURCE,
          new File(['%PDF-1.7 resource'], 'guide.pdf', {
            type: 'application/pdf',
          }),
        );
        await r.saveResource(course, section, ids.RESOURCE, {
          description: 'Academic guide',
          downloadAllowed: true,
        });
        const dto = await r.item(course, section, ids.PDF);
        assert.ok(!JSON.stringify(dto).includes('storageKey'));
        assert.equal(dto.lesson?.attached, true);
      },
    );
    await t.test(
      'Attachment replacement cleans owned unreferenced files; no public assets or database bytes',
      async () => {
        const old = await db.learningResource.findUniqueOrThrow({
          where: { itemId: ids.RESOURCE },
        });
        await media.attach(
          course,
          section,
          ids.RESOURCE,
          new File(['%PDF-1.7 replacement'], 'guide-new.pdf', {
            type: 'application/pdf',
          }),
        );
        await assert.rejects(readFile(join(root, old.storageKey!)));
        assert.equal(
          await db.academicAudit.count({
            where: {
              action: 'AcademicAssetCleanupConfirmed',
              targetId: ids.RESOURCE,
            },
          }),
          1,
        );
        const resource = await db.learningResource.findUniqueOrThrow({
          where: { itemId: ids.RESOURCE },
        });
        assert.ok(resource.storageKey?.startsWith('academic-'));
        assert.ok(!JSON.stringify(resource).includes('%PDF-'));
      },
    );
    await t.test(
      'Publish configured hierarchy; hidden drafts remain hidden and private media is enrolled-only',
      async () => {
        for (const type of [
          'LESSON',
          'QUIZ',
          'ASSESSMENT',
          'ASSIGNMENT',
          'RESOURCE',
          'LIVE_SESSION',
        ] as const)
          await r.saveItem(course, section, ids[type], {
            title: type,
            type,
            required: true,
            published: true,
          });
        await r.saveSection(course, section, {
          title: 'Foundations',
          description: null,
          published: true,
        });
        await r.saveCourse(course, {
          ...courseData,
          programId: program,
          published: true,
        });
        assert.ok((await learning.course(course)).sections.length > 0);
        assert.equal(
          (await new LearningRepository(db, outsider).courses()).length,
          0,
        );
        await assert.rejects(
          new LearningRepository(db, outsider).resourceMedia(
            course,
            ids.RESOURCE,
          ),
          { code: 'NOT_FOUND' },
        );
        assert.equal(
          (await learning.resourceMedia(course, ids.RESOURCE)).mimeType,
          'application/pdf',
        );
        const draft = await r.saveItem(course, section, null, {
          title: 'Hidden draft',
          type: 'LESSON',
          required: false,
          published: false,
        });
        assert.ok(
          !JSON.stringify(await learning.course(course)).includes(draft),
        );
      },
    );
    await t.test(
      'Snapshot scoring survives correct-answer edits; exact multiple-choice/Boolean unchanged',
      async () => {
        const attempts = new Attempts(db, student.id),
          a = await attempts.start(course, ids.QUIZ);
        assert.ok(!JSON.stringify(a).includes('correct'));
        const answers = a.questions.map((q) => ({
          questionId: q.id,
          optionIds: q.options
            .slice(0, q.type === 'MULTIPLE_CHOICE' ? 2 : 1)
            .map((o) => o.id),
        }));
        await r.saveQuestion(ids.BANK, ids.SINGLE, {
          type: 'SINGLE_CHOICE',
          prompt: 'New key uses B',
          explanation: null,
          published: true,
          options: [
            { label: 'A', correct: false },
            { label: 'B', correct: true },
          ],
        });
        await attempts.save(course, ids.QUIZ, a.id, { answers });
        const submitted = await attempts.submit(course, ids.QUIZ, a.id);
        assert.equal(submitted.percentage, 100);
        assert.equal(submitted.requiresReview, false);
        await r.saveActivity(course, section, ids.QUIZ, {
          ...activityData,
          passingPercent: 80,
          questions: [{ questionId: ids.SINGLE, points: 5 }],
        });
        assert.equal(
          (await db.academicAttempt.findUniqueOrThrow({ where: { id: a.id } }))
            .maxScore,
          4,
        );
        await assert.rejects(
          r.saveQuestion(ids.BANK, ids.SINGLE, {
            type: 'SINGLE_CHOICE',
            prompt: 'Hidden',
            explanation: null,
            published: false,
            options: [
              { label: 'A', correct: true },
              { label: 'B', correct: false },
            ],
          }),
          { code: 'CONFLICT' },
        );
      },
    );
    await t.test(
      'Text assessment requires review with no semantic interpretation',
      async () => {
        const attempts = new Attempts(db, student.id),
          a = await attempts.start(course, ids.ASSESSMENT);
        await attempts.save(course, ids.ASSESSMENT, a.id, {
          answers: [{ questionId: ids.SHORT, text: 'Personal reflection' }],
        });
        const result = await attempts.submit(course, ids.ASSESSMENT, a.id);
        assert.equal(result.requiresReview, true);
        assert.equal(
          (await attempts.view(course, ids.ASSESSMENT)).kind,
          'ASSESSMENT',
        );
        assert.ok(!JSON.stringify(result).includes('interpretation'));
      },
    );
    await t.test(
      'Assignment authoring preserves immutable submission versions and protects policy',
      async () => {
        await new Assignments(db, student.id).submit(course, ids.ASSIGNMENT, {
          requestKey: randomUUID(),
          kind: 'TEXT',
          text: 'Preserve my original work.',
        });
        const before = await db.submissionVersion.findMany();
        await r.saveAssignment(course, section, ids.ASSIGNMENT, {
          ...assignmentData,
          instructions: 'Revised instructions',
        });
        assert.deepEqual(await db.submissionVersion.findMany(), before);
        await assert.rejects(
          r.saveAssignment(course, section, ids.ASSIGNMENT, {
            ...assignmentData,
            requiresAcceptance: false,
          }),
          { code: 'CONFLICT' },
        );
        await assert.rejects(
          denied.saveAssignment(
            course,
            section,
            ids.ASSIGNMENT,
            assignmentData,
          ),
          { code: 'FORBIDDEN' },
        );
      },
    );
    await t.test(
      'Multiple Batch occurrences bind one live item; wrong Course/item/Instructor scope rejected',
      async () => {
        const b = await db.batch.create({
            data: { code: 'A2-DOMAIN', name: 'A2 Batch', courseId: course },
          }),
          ops = new AdminOperations(db, admin.id);
        const session = {
          title: 'Occurrence',
          courseId: course,
          itemId: ids.LIVE_SESSION,
          instructorId: null,
          startsAt: '2026-10-05T10:00:00Z',
          endsAt: '2026-10-05T11:00:00Z',
          status: 'SCHEDULED',
          externalTargetId: 'approved',
          locationLabel: null,
        };
        await ops.session(b.id, null, session);
        await ops.session(b.id, null, {
          ...session,
          title: 'Second occurrence',
        });
        assert.equal(
          (await r.item(course, section, ids.LIVE_SESSION)).sessions.length,
          2,
        );
        await assert.rejects(
          ops.session(b.id, null, { ...session, itemId: ids.LESSON }),
          { code: 'INVALID_INPUT' },
        );
        await assert.rejects(
          ops.session(b.id, null, { ...session, instructorId: student.id }),
          { code: 'FORBIDDEN' },
        );
        assert.equal(await db.batchSessionRecording.count(), 0);
        assert.equal(await db.attendanceRecord.count(), 0);
      },
    );
    await t.test(
      'Safe removal blocks referenced/history-bearing items and populated Sections',
      async () => {
        await r.saveItem(course, section, ids.QUIZ, {
          title: 'QUIZ',
          type: 'QUIZ',
          required: true,
          published: false,
        });
        await assert.rejects(r.removeItem(course, section, ids.QUIZ), {
          code: 'CONFLICT',
        });
        await assert.rejects(r.removeSection(course, section), {
          code: 'CONFLICT',
        });
        const empty = await r.saveSection(course, null, {
          title: 'Unused',
          description: null,
          published: false,
        });
        const unused = await r.saveItem(course, empty, null, {
          title: 'Unused',
          type: 'LESSON',
          required: false,
          published: false,
        });
        await r.removeItem(course, empty, unused);
        await r.removeSection(course, empty);
        assert.equal(await db.academicAttempt.count(), 2);
        assert.equal(await db.submissionVersion.count(), 1);
      },
    );
    await t.test(
      'Course/Section/item publication gates remain independent',
      async () => {
        await r.saveSection(course, section, {
          title: 'Foundations',
          description: null,
          published: false,
        });
        await assert.rejects(learning.lesson(course, ids.LESSON), {
          code: 'NOT_FOUND',
        });
        await r.saveSection(course, section, {
          title: 'Foundations',
          description: null,
          published: true,
        });
        await r.saveCourse(course, {
          ...courseData,
          programId: program,
          published: false,
        });
        await assert.rejects(learning.course(course), { code: 'NOT_FOUND' });
      },
    );
    await t.test(
      'Interrupted media repair preserves references and is repeatable',
      async () => {
        const key = `academic-${randomUUID()}.pdf`;
        await writeFile(join(root, key), '%PDF-1.7 orphan');
        await db.academicAudit.create({
          data: {
            actorId: admin.id,
            action: 'AcademicAssetUploadRequested',
            targetId: ids.PDF,
            details: { storageKey: key },
            createdAt: new Date(Date.now() - 7200000),
          },
        });
        const current = await db.lesson.findUniqueOrThrow({
          where: { itemId: ids.PDF },
        });
        assert.ok(current.storageKey);
        assert.equal(await media.cleanup(current.storageKey, ids.PDF), false);
        assert.ok((await readFile(join(root, current.storageKey))).length);
        const repaired = await media.reconcile();
        assert.ok(repaired.cleaned >= 1);
        await assert.rejects(readFile(join(root, key)), { code: 'ENOENT' });
        const confirmed = await db.academicAudit.count({
          where: { action: 'AcademicAssetCleanupConfirmed' },
        });
        await media.reconcile();
        assert.equal(
          await db.academicAudit.count({
            where: { action: 'AcademicAssetCleanupConfirmed' },
          }),
          confirmed,
        );
        assert.ok((await readFile(join(root, current.storageKey))).length);
      },
    );
    await t.test(
      'Sensitive mutations audited concisely; revoked additional ADMIN denies fresh writes',
      async () => {
        const actions = (await db.academicAudit.findMany()).map(
          (a) => a.action,
        );
        for (const action of [
          'ProgramSaved',
          'CourseSaved',
          'SectionSaved',
          'SectionOrdered',
          'LearningItemSaved',
          'LearningItemOrdered',
          'LessonSaved',
          'QuestionBankSaved',
          'QuestionSaved',
          'AcademicActivitySaved',
          'AssignmentSaved',
          'LiveSessionCreated',
        ])
          assert.ok(actions.includes(action), action);
        assert.ok(
          !(await db.academicAudit.findMany()).some((a) =>
            JSON.stringify(a.details).includes('Preserve my original work'),
          ),
        );
        await db.userRoleAssignment.delete({
          where: { userId_role: { userId: admin.id, role: 'ADMIN' } },
        });
        await assert.rejects(
          r.saveProgram(program, { title: 'Revoked write' }),
          { code: 'FORBIDDEN' },
        );
      },
    );
  } finally {
    await f.cleanup();
    await rm(root, { recursive: true, force: true });
    for (const [key, value] of [
      ['LMS_FILES_ROOT', savedRoot],
      ['LMS_EXTERNAL_LINKS', savedLinks],
      ['LMS_EXTERNAL_ORIGINS', savedOrigins],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
