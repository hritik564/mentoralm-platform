import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase } from './helpers/d4-database';
import {
  offeringInput,
  pageSettings,
  overviewSection,
  outcomesSection,
  faqSection,
  marketplaceActor,
} from './helpers/marketplace-m2';
import { AdminMarketplace } from '../src/lib/marketplace/admin';
import { AdminMarketplacePages } from '../src/lib/marketplace/admin-pages';
import { readPublishedProgram } from '../src/lib/marketplace/program-queries';
import { programMetadata } from '../src/components/marketplace/program/metadata';
import { adminId, adminHandle } from '../src/lib/admin/handles';
import { migrationManifest } from '../src/lib/production/migrations';
import { requireMarketplacePageBaseline } from '../scripts/marketplace/safety';
import {
  auditRegistry,
  safeAuditSummary,
} from '../src/lib/admin/governance/audit-projection';
const migration = '20261118110000_marketplace_page_content';

test('M2 migration is additive, contains only page metadata and leaves learning tables alone', () => {
  const sql = readFileSync(
    `prisma/migrations/${migration}/migration.sql`,
    'utf8',
  );
  assert.doesNotMatch(sql, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/im);
  assert.equal((sql.match(/CREATE TYPE/g) || []).length, 1);
  assert.equal((sql.match(/CREATE TABLE/g) || []).length, 2);
  assert.doesNotMatch(
    sql,
    /ALTER TABLE "(?:User|Course|Enrollment|LearningItem)"/,
  );
  assert.match(sql, /ON DELETE RESTRICT ON UPDATE RESTRICT/);
  assert.match(sql, /UNIQUE INDEX[^\n]*pageId_position/);
});
test('M2 local migration guard refuses missing baseline, corrupt history and any unrelated pending work', () => {
  const rows = migrationManifest.map((m) => ({
    migration_name: m.name,
    checksum: m.checksum,
    finished_at: new Date(),
    rolled_back_at: null,
  }));
  assert.deepEqual(requireMarketplacePageBaseline(rows), []);
  assert.throws(() => requireMarketplacePageBaseline(rows.slice(0, -1)));
  assert.throws(() => requireMarketplacePageBaseline(rows.slice(0, -2)));
  for (const invalid of [
    rows.slice(0, -2),
    [],
    [...rows, rows[0]],
    [{ ...rows[0], checksum: 'tampered' }],
    [{ ...rows[0], finished_at: null }],
  ])
    assert.throws(() => requireMarketplacePageBaseline(invalid));
});

test('M2 page content security, structured writes, publication, concurrency and atomic audit', async (t) => {
  const fixture = await isolatedDatabase(),
    db = fixture.db;
  try {
    const actor = await marketplaceActor(db),
      academic = await marketplaceActor(db, ['ACADEMICS_MANAGE']);
    const student = await db.user.create({
      data: { clerkUserId: `m2_student_${randomUUID()}` },
    });
    const catalogue = new AdminMarketplace(db, actor.id),
      service = new AdminMarketplacePages(db, actor.id);
    const id = await catalogue.save(null, offeringInput('m2-program'));
    const other = await catalogue.save(null, offeringInput('m2-other'));
    let sectionId = '';
    const detail = () => service.detail(id);
    await t.test(
      'academic-only, Student and missing policy actors cannot read or mutate page content',
      async () => {
        const noPolicy = await db.user.create({
          data: { clerkUserId: `m2_none_${randomUUID()}`, role: 'ADMIN' },
        });
        for (const actorId of [academic.id, student.id, noPolicy.id]) {
          const denied = new AdminMarketplacePages(db, actorId);
          for (const op of [
            () => denied.detail(id),
            () => denied.saveSettings(id, { ...pageSettings, revision: null }),
            () =>
              denied.createSection(id, { ...overviewSection, revision: null }),
            () =>
              denied.updateSection(id, 'unknown', {
                ...overviewSection,
                revision: randomUUID(),
              }),
            () =>
              denied.setSectionEnabled(id, 'unknown', {
                revision: randomUUID(),
                enabled: false,
              }),
            () =>
              denied.reorderSections(id, {
                revision: randomUUID(),
                sectionRefs: [],
              }),
          ])
            await assert.rejects(op, { code: 'FORBIDDEN' });
        }
        assert.equal(await db.marketplaceOfferingPage.count(), 0);
      },
    );
    await t.test(
      'Draft/Unpublished/Archived/unknown all have the same public null result',
      async () => {
        for (const publicationStatus of [
          'DRAFT',
          'UNPUBLISHED',
          'ARCHIVED',
        ] as const) {
          await db.marketplaceOffering.update({
            where: { id },
            data: { publicationStatus },
          });
          assert.deepEqual(await readPublishedProgram(db, 'm2-program'), {
            status: 'ready',
            program: null,
          });
        }
        assert.deepEqual(await readPublishedProgram(db, 'unknown'), {
          status: 'ready',
          program: null,
        });
        await db.marketplaceOffering.update({
          where: { id },
          data: { publicationStatus: 'DRAFT' },
        });
      },
    );
    await t.test(
      'Published offering without any page content resolves a valid basic public DTO',
      async () => {
        await catalogue.publish(id, {
          revision: (await catalogue.detail(id)).revision,
        });
        const result = await readPublishedProgram(db, 'm2-program');
        assert.equal(result.status, 'ready');
        assert.ok(result.program);
        assert.deepEqual(result.program.page.sections, []);
        assert.equal(result.program.title, 'M2 Isolated Program');
        const meta = programMetadata(result.program);
        assert.ok(JSON.stringify(meta.title).includes(result.program.title));
        assert.equal(meta.description, result.program.shortDescription);
        assert.ok(
          JSON.stringify(meta.alternates).includes('/courses/m2-program'),
        );
      },
    );
    await t.test(
      'optional page reads create no records and settings can be created with null revision',
      async () => {
        const before = await db.marketplaceOfferingPage.count();
        const empty = await detail();
        assert.equal(empty.revision, null);
        assert.equal(await db.marketplaceOfferingPage.count(), before);
        await service.saveSettings(id, { ...pageSettings, revision: null });
        const page = await detail();
        assert.ok(page.revision);
        assert.equal(page.heroHeadline, pageSettings.heroHeadline);
        await assert.rejects(
          service.saveSettings(id, { ...pageSettings, revision: null }),
          { code: 'CONFLICT' },
        );
        const result = await readPublishedProgram(db, 'm2-program');
        assert.ok(result.program);
        const draftMeta = programMetadata(result.program);
        assert.deepEqual(draftMeta.title, {
          absolute: 'M2 Isolated Program | MentoraLM',
        });
        assert.equal(draftMeta.description, result.program.shortDescription);
        await service.publishPage(id, { revision: (await detail()).revision });
        const published = await readPublishedProgram(db, 'm2-program');
        assert.ok(published.program);
        const meta = programMetadata(published.program);
        assert.deepEqual(meta.title, { absolute: pageSettings.seoTitle });
        assert.equal(meta.description, pageSettings.seoDescription);
        assert.ok(
          JSON.stringify(meta.openGraph).includes(pageSettings.seoTitle),
        );
        assert.ok(JSON.stringify(meta.twitter).includes(pageSettings.seoTitle));
      },
    );
    await t.test(
      'create section persists bounded structured content, opaque reference and aggregate revision',
      async () => {
        const before = await detail();
        await service.createSection(id, {
          ...overviewSection,
          revision: before.revision,
        });
        const after = await detail();
        assert.notEqual(after.revision, before.revision);
        assert.equal(after.sections.length, 1);
        sectionId = adminId('offering-section', after.sections[0].ref);
        assert.ok(sectionId);
        assert.ok(!('id' in after.sections[0]));
        assert.deepEqual(after.sections[0].content, overviewSection.content);
      },
    );
    await t.test(
      'all eight supported structured section types persist without LMS content writes',
      async () => {
        const variants = [
          outcomesSection,
          faqSection,
          {
            type: 'CURRICULUM',
            title: 'Curriculum',
            subtitle: null,
            enabled: true,
            content: {
              modules: [
                {
                  title: 'First module',
                  description: 'Develop a practical project.',
                },
              ],
            },
          },
          ...(['ELIGIBILITY', 'WHO_IS_IT_FOR', 'HIGHLIGHTS'] as const).map(
            (type) => ({
              type,
              title: type,
              subtitle: null,
              enabled: true,
              content: { items: ['A useful structured item'] },
            }),
          ),
          {
            type: 'TEXT',
            title: 'Additional information',
            subtitle: null,
            enabled: true,
            content: { body: 'Plain text information.' },
          },
        ];
        for (const section of variants)
          await service.createSection(id, {
            ...section,
            revision: (await detail()).revision,
          });
        assert.equal((await detail()).sections.length, 8);
        assert.equal(await db.learningItem.count(), 0);
        assert.equal(await db.enrollment.count(), 0);
      },
    );
    await t.test(
      'edit rotates aggregate revision and stale section/settings writes are rejected',
      async () => {
        const before = await detail();
        await service.updateSection(id, sectionId, {
          ...overviewSection,
          title: 'Updated overview',
          revision: before.revision,
        });
        assert.notEqual((await detail()).revision, before.revision);
        await assert.rejects(
          service.updateSection(id, sectionId, {
            ...overviewSection,
            revision: before.revision,
          }),
          { code: 'CONFLICT' },
        );
        await assert.rejects(
          service.saveSettings(id, {
            ...pageSettings,
            revision: before.revision,
          }),
          { code: 'CONFLICT' },
        );
      },
    );
    await t.test(
      'cross-offering and wrong-kind section references fail without modifying the page',
      async () => {
        const before = await detail();
        await assert.rejects(
          service.updateSection(other, sectionId, {
            ...overviewSection,
            revision: null,
          }),
        );
        await assert.rejects(
          service.reorderSections(id, {
            revision: before.revision,
            sectionRefs: [adminHandle('offering', id)],
          }),
        );
        assert.deepEqual(await detail(), before);
      },
    );
    await t.test(
      'disabled and empty sections are excluded from public content; enabled sections keep Admin order',
      async () => {
        await service.setSectionEnabled(id, sectionId, {
          revision: (await detail()).revision,
          enabled: false,
        });
        await service.publishPage(id, { revision: (await detail()).revision });
        let pub = await readPublishedProgram(db, 'm2-program');
        assert.ok(pub.program);
        assert.ok(
          !pub.program.page.sections.some(
            (s) => s.title === 'Updated overview',
          ),
        );
        await service.setSectionEnabled(id, sectionId, {
          revision: (await detail()).revision,
          enabled: true,
        });
        let page = await detail();
        const refs = page.sections.map((s) => s.ref).reverse();
        await service.reorderSections(id, {
          revision: page.revision,
          sectionRefs: refs,
        });
        page = await detail();
        assert.deepEqual(
          page.sections.map((s) => s.ref),
          refs,
        );
        await service.publishPage(id, { revision: (await detail()).revision });
        pub = await readPublishedProgram(db, 'm2-program');
        assert.ok(pub.program);
        assert.deepEqual(
          pub.program.page.sections.map((s) => s.title),
          page.sections.map((s) => s.title),
        );
        await service.createSection(id, {
          ...overviewSection,
          title: 'Empty draft section',
          content: { body: '' },
          revision: page.revision,
        });
        pub = await readPublishedProgram(db, 'm2-program');
        assert.ok(pub.program);
        assert.ok(
          !pub.program.page.sections.some(
            (s) => s.title === 'Empty draft section',
          ),
        );
      },
    );
    await t.test(
      'strict validation rejects unknown fields, scripts, malformed structures and excessive bounds',
      async () => {
        const before = await detail();
        const invalid = [
          { ...overviewSection, actorId: actor.id },
          { ...overviewSection, title: '<script>alert(1)</script>' },
          { ...overviewSection, title: 'x'.repeat(161) },
          { ...overviewSection, content: { body: 'x'.repeat(6001) } },
          {
            ...overviewSection,
            content: { body: '<img src=x onerror=alert(1)>' },
          },
          { ...overviewSection, content: { body: 'hello', extra: true } },
          {
            ...outcomesSection,
            content: { items: Array.from({ length: 21 }, () => 'item') },
          },
          { ...outcomesSection, content: { items: ['x'.repeat(301)] } },
          {
            ...faqSection,
            content: { items: [{ question: 'q', answer: 'a'.repeat(2001) }] },
          },
          {
            ...faqSection,
            content: { items: [{ question: 'q'.repeat(241), answer: 'a' }] },
          },
          { ...overviewSection, type: 'DELIVERY' },
          { ...overviewSection, position: 999 },
          { ...overviewSection, content: { items: ['wrong shape'] } },
        ];
        for (const section of invalid)
          await assert.rejects(
            service.createSection(id, {
              ...section,
              revision: before.revision,
            }),
            { code: 'INVALID_INPUT' },
          );
        await assert.rejects(
          service.saveSettings(id, {
            ...pageSettings,
            revision: before.revision,
            seoTitle: 'x'.repeat(501),
          }),
          { code: 'INVALID_INPUT' },
        );
        assert.deepEqual(await detail(), before);
      },
    );
    await t.test(
      'reorder requires exactly all own section references, with no duplicates or omissions',
      async () => {
        const before = await detail(),
          refs = before.sections.map((s) => s.ref);
        for (const sectionRefs of [
          refs.slice(1),
          [...refs, refs[0]],
          [...refs.slice(1), refs[1]],
          [...refs.slice(1), adminHandle('offering-section', 'unknown')],
        ])
          await assert.rejects(
            service.reorderSections(id, {
              revision: before.revision,
              sectionRefs,
            }),
          );
        assert.deepEqual(await detail(), before);
      },
    );
    await t.test(
      'concurrent writes using one revision commit exactly once',
      async () => {
        const before = await detail();
        const results = await Promise.allSettled([
          service.saveSettings(id, {
            ...pageSettings,
            heroHeadline: 'Concurrent writer A',
            revision: before.revision,
          }),
          service.saveSettings(id, {
            ...pageSettings,
            heroHeadline: 'Concurrent writer B',
            revision: before.revision,
          }),
        ]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        const rejected = results.find((r) => r.status === 'rejected');
        assert.equal(rejected?.status, 'rejected');
        if (rejected?.status === 'rejected')
          assert.equal(rejected.reason.code, 'CONFLICT');
      },
    );
    await t.test(
      'atomic audit failure rolls back content, ordering and aggregate revision',
      async () => {
        const before = await detail();
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${fixture.schema}".reject_m2_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'M2 audit failure'; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER m2_audit_failure BEFORE INSERT ON "${fixture.schema}"."AcademicAudit" FOR EACH ROW EXECUTE FUNCTION "${fixture.schema}".reject_m2_audit()`,
        );
        try {
          await assert.rejects(
            service.saveSettings(id, {
              ...pageSettings,
              heroHeadline: 'Must roll back',
              revision: before.revision,
            }),
          );
          await assert.rejects(
            service.reorderSections(id, {
              revision: before.revision,
              sectionRefs: before.sections.map((s) => s.ref).reverse(),
            }),
          );
          assert.deepEqual(await detail(), before);
        } finally {
          await db.$executeRawUnsafe(
            `DROP TRIGGER m2_audit_failure ON "${fixture.schema}"."AcademicAudit"`,
          );
        }
      },
    );
    await t.test(
      'content audits are registered and never copy body, answers or SEO text',
      async () => {
        const events = await db.academicAudit.findMany({
          where: { action: { startsWith: 'Marketplace' } },
        });
        for (const action of [
          'MarketplacePageDraftUpdated',
          'MarketplaceSectionDraftCreated',
          'MarketplaceSectionDraftUpdated',
          'MarketplaceSectionDraftReordered',
        ]) {
          assert.ok(
            events.some((e) => e.action === action),
            action,
          );
          assert.equal(auditRegistry[action].category, 'Marketplace');
        }
        for (const e of events.filter(
          (e) => !e.action.startsWith('MarketplaceOffering'),
        )) {
          const serialized = JSON.stringify(e.details);
          assert.ok(!serialized.includes(pageSettings.heroSummary));
          assert.ok(!serialized.includes(overviewSection.content.body));
          assert.ok(!serialized.includes(faqSection.content.items[0].answer));
          assert.ok(safeAuditSummary(e.action, e.details).length > 0);
        }
      },
    );
    await t.test(
      'public DTO strips all internal IDs/revisions/enrollment state and ignores corrupt draft JSON',
      async () => {
        const pub = await readPublishedProgram(db, 'm2-program');
        assert.ok(pub.program);
        const serialized = JSON.stringify(pub.program);
        for (const value of [
          id,
          actor.id,
          student.id,
          (await detail()).revision!,
        ])
          assert.ok(!serialized.includes(value));
        for (const key of [
          'courseId',
          'lmsEnabled',
          'revision',
          'publishedAt',
          'createdAt',
          'updatedAt',
          'pageId',
        ])
          assert.ok(!serialized.includes(`"${key}"`));
        await db.marketplaceOfferingSection.update({
          where: { id: sectionId },
          data: { contentJson: { unexpected: 'invalid structured data' } },
        });
        const invalid = await readPublishedProgram(db, 'm2-program');
        assert.deepEqual(
          invalid,
          pub,
          'Corrupt mutable draft content cannot change an immutable published version',
        );
        assert.ok(invalid.program);
        assert.ok(
          invalid.program.page.sections.some(
            (s) => s.title === 'Updated overview',
          ),
        );
      },
    );
    await db.marketplaceOfferingSection.update({
      where: { id: sectionId },
      data: { contentJson: overviewSection.content },
    });
    await t.test('server enforces maximum section count', async () => {
      while ((await detail()).sections.length < 20)
        await service.createSection(id, {
          ...overviewSection,
          revision: (await detail()).revision,
        });
      await assert.rejects(
        service.createSection(id, {
          ...overviewSection,
          revision: (await detail()).revision,
        }),
        { code: 'INVALID_INPUT' },
      );
    });
    await t.test(
      'archived parent makes every content mutation read-only',
      async () => {
        await catalogue.archive(id, {
          revision: (await catalogue.detail(id)).revision,
        });
        const before = await detail();
        for (const operation of [
          () =>
            service.saveSettings(id, {
              ...pageSettings,
              revision: before.revision,
            }),
          () =>
            service.createSection(id, {
              ...overviewSection,
              revision: before.revision,
            }),
          () =>
            service.updateSection(id, sectionId, {
              ...overviewSection,
              revision: before.revision,
            }),
          () =>
            service.setSectionEnabled(id, sectionId, {
              revision: before.revision,
              enabled: false,
            }),
          () =>
            service.reorderSections(id, {
              revision: before.revision,
              sectionRefs: before.sections.map((s) => s.ref),
            }),
        ])
          await assert.rejects(operation);
        assert.deepEqual(await detail(), before);
        assert.equal(await db.enrollment.count(), 0);
        assert.equal(await db.course.count(), 0);
      },
    );
  } finally {
    await fixture.cleanup();
  }
});

test('M2 migrates populated M1 baseline preserving exact Offering, User, Course and Enrollment rows', async () => {
  const fixture = await isolatedDatabase(
    undefined,
    '20261118101000_marketplace_permission_capacity',
  );
  try {
    const db = fixture.db,
      user = await db.user.create({
        data: { clerkUserId: `m2_upgrade_${randomUUID()}` },
      }),
      course = await db.course.create({
        data: {
          title: 'Historical course',
          description: 'Preserved',
          thumbnailPath: '/images/campus.webp',
          thumbnailAlt: 'Campus',
          publicPath: '/#programs',
        },
      }),
      enrollment = await db.enrollment.create({
        data: { userId: user.id, courseId: course.id },
      });
    const { courseRef, ...input } = offeringInput('m2-existing');
    assert.equal(courseRef, null);
    const offering = await db.marketplaceOffering.create({
      data: {
        ...input,
        lmsEnabled: true,
        courseId: course.id,
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: fixture.url }, stdio: 'pipe' },
    );
    for (const [actual, expected] of [
      [await db.user.findUniqueOrThrow({ where: { id: user.id } }), user],
      [await db.course.findUniqueOrThrow({ where: { id: course.id } }), course],
      [
        await db.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
        enrollment,
      ],
      [
        await db.marketplaceOffering.findUniqueOrThrow({
          where: { id: offering.id },
        }),
        offering,
      ],
    ])
      assert.deepEqual(actual, expected);
    assert.equal(await db.marketplaceOfferingPage.count(), 0);
    assert.equal(await db.marketplaceOfferingSection.count(), 0);
    const pub = await readPublishedProgram(db, 'm2-existing');
    assert.ok(pub.program);
    assert.equal(pub.program.title, offering.title);
  } finally {
    await fixture.cleanup();
  }
});
