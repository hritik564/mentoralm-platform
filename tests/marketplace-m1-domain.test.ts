import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase, migrationCount } from './helpers/d4-database';
import { parseMarketplacePrice } from '../src/lib/marketplace/price';
import { AdminMarketplace } from '../src/lib/marketplace/admin';
import { readPublishedOfferings } from '../src/lib/marketplace/queries';
import type { OfferingInput } from '../src/lib/marketplace/types';
import { adminId, adminHandle } from '../src/lib/admin/handles';
import {
  safeAuditSummary,
  auditRegistry,
} from '../src/lib/admin/governance/audit-projection';

import {
  adminPermissions,
  legacyAdminPermissions,
} from '../src/lib/admin/permissions';
import { requireAdminPermission } from '../src/lib/auth/admin-policy';
import { policyChangeInput } from '../src/lib/admin/governance/access';

const migration = '20261118090000_marketplace_m1';
function rejectsConstraint(name: string) {
  return (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(
      error.message.includes(name),
      `Expected database constraint ${name}`,
    );
    return true;
  };
}
const sample = (slug: string): OfferingInput => ({
  title: 'CareerIgnite Test Offering',
  slug,
  shortDescription: 'Build career skills through guided projects and learning.',
  category: 'Career readiness',
  cardImage: null,
  heroImage: null,
  deliveryMode: 'ONLINE',
  durationLabel: '12 weeks',
  priceMinor: 1500000,
  currency: 'INR',
  availabilityStatus: 'COMING_SOON',
  featured: true,
  sortOrder: 0,
  lmsEnabled: false,
  courseRef: null,
  cohortStartsAt: null,
});

test('M1 migration adds only catalogue metadata and an optional existing Course reference', () => {
  const sql = readFileSync(
    `prisma/migrations/${migration}/migration.sql`,
    'utf8',
  );
  assert.doesNotMatch(sql, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/im);
  assert.equal((sql.match(/CREATE TYPE/g) || []).length, 3);
  assert.equal((sql.match(/CREATE TABLE/g) || []).length, 1);
  assert.match(
    sql,
    /REFERENCES "Course"\("id"\) ON DELETE RESTRICT ON UPDATE RESTRICT/,
  );
  assert.doesNotMatch(
    sql,
    /CREATE TABLE "(?:Course|Enrollment|Order|Payment)"/,
  );
});

test('M1 catalogue security, publication, canonical course boundaries and transaction integrity', async (t) => {
  const fixture = await isolatedDatabase(),
    db = fixture.db;
  try {
    const actor = await db.user.create({
      data: {
        clerkUserId: `m1_admin_${randomUUID()}`,
        roleAssignments: { create: { role: 'ADMIN' } },
        adminAuthorization: { create: { permissions: ['MARKETPLACE_MANAGE'] } },
      },
    });
    const student = await db.user.create({
      data: { clerkUserId: `m1_student_${randomUUID()}` },
    });
    const unrelated = await db.user.create({
      data: {
        clerkUserId: `m1_unrelated_${randomUUID()}`,
        role: 'ADMIN',
        adminAuthorization: { create: { permissions: ['BATCHES_MANAGE'] } },
      },
    });
    const academicOnly = await db.user.create({
      data: {
        clerkUserId: `m1_academic_${randomUUID()}`,
        role: 'ADMIN',
        adminAuthorization: { create: { permissions: ['ACADEMICS_MANAGE'] } },
      },
    });
    const governor = await db.user.create({
      data: {
        clerkUserId: `m1_governor_${randomUUID()}`,
        role: 'ADMIN',
        adminAuthorization: { create: { authority: 'GOVERNANCE' } },
      },
    });
    const missingPolicy = await db.user.create({
      data: { clerkUserId: `m1_missing_policy_${randomUUID()}`, role: 'ADMIN' },
    });
    const emptyPolicy = await db.user.create({
      data: {
        clerkUserId: `m1_empty_policy_${randomUUID()}`,
        role: 'ADMIN',
        adminAuthorization: { create: {} },
      },
    });
    const policyWithoutRole = await db.user.create({
      data: {
        clerkUserId: `m1_orphan_${randomUUID()}`,
        adminAuthorization: { create: { authority: 'GOVERNANCE' } },
      },
    });
    const service = new AdminMarketplace(db, actor.id);
    let id = '',
      revision = '';

    await t.test(
      'empty public and authorized Admin catalogues return successful empty results',
      async () => {
        assert.deepEqual(await readPublishedOfferings(db), {
          status: 'ready',
          page: 1,
          total: 0,
          offerings: [],
        });
        assert.deepEqual(await service.list(), { page: 1, total: 0, rows: [] });
      },
    );

    await t.test(
      'students, unrelated capabilities, absent policies and orphan policies cannot read or mutate',
      async () => {
        const beforeOfferings = await db.marketplaceOffering.count();
        const beforeAudits = await db.academicAudit.count();
        for (const actorId of [
          student.id,
          unrelated.id,
          academicOnly.id,
          missingPolicy.id,
          emptyPolicy.id,
          policyWithoutRole.id,
        ]) {
          const denied = new AdminMarketplace(db, actorId);
          const operations = [
            () => denied.list(),
            () => denied.courses(),
            () => denied.detail('unknown'),
            () => denied.save(null, sample('denied')),
            () => denied.publish('unknown', { revision: randomUUID() }),
            () => denied.unpublish('unknown', { revision: randomUUID() }),
            () => denied.archive('unknown', { revision: randomUUID() }),
          ];
          for (const operation of operations)
            await assert.rejects(operation, { code: 'FORBIDDEN' });
        }
        assert.equal(await db.marketplaceOffering.count(), beforeOfferings);
        assert.equal(await db.academicAudit.count(), beforeAudits);
      },
    );

    await t.test(
      'human INR input persists exact integer prices and preserves null/zero semantics',
      async () => {
        for (const [index, input, expected] of [
          [0, '15000', 1500000],
          [1, '15000.00', 1500000],
          [2, '15000.50', 1500050],
          [3, '0', 0],
          [4, null, null],
        ] as const) {
          const saved = await service.save(null, {
            ...sample(`human-price-${index}`),
            priceMinor: parseMarketplacePrice(input, 'INR'),
          });
          assert.equal(
            (
              await db.marketplaceOffering.findUniqueOrThrow({
                where: { id: saved },
              })
            ).priceMinor,
            expected,
          );
        }
      },
    );

    await t.test(
      'the new capability preserves academic isolation and supports the complete validated permission set',
      async () => {
        assert.ok(!legacyAdminPermissions.includes('MARKETPLACE_MANAGE'));
        await assert.rejects(
          () => requireAdminPermission(db, actor.id, 'ACADEMICS_MANAGE'),
          { code: 'FORBIDDEN' },
        );
        await requireAdminPermission(db, academicOnly.id, 'ACADEMICS_MANAGE');
        const validated = policyChangeInput.parse({
          authority: 'SCOPED',
          permissions: [...adminPermissions],
          expectedRevision: null,
          confirmation: true,
          reason: 'Verify all thirteen persisted capabilities in isolated Test',
        });
        await db.adminAuthorization.update({
          where: { userId: unrelated.id },
          data: { permissions: validated.permissions },
        });
        assert.deepEqual(
          (
            await db.adminAuthorization.findUniqueOrThrow({
              where: { userId: unrelated.id },
            })
          ).permissions,
          [...adminPermissions],
        );
        for (const expression of [
          `ARRAY['MARKETPLACE_MANAGE','MARKETPLACE_MANAGE']::"AdminPermission"[]`,
          `ARRAY[NULL]::"AdminPermission"[]`,
          `ARRAY[['MARKETPLACE_MANAGE'],['ACADEMICS_MANAGE']]::"AdminPermission"[]`,
        ])
          await assert.rejects(
            db.$executeRawUnsafe(
              `UPDATE "${fixture.schema}"."AdminAuthorization" SET permissions=${expression} WHERE "userId"='${unrelated.id}'`,
            ),
          );
        await db.adminAuthorization.update({
          where: { userId: unrelated.id },
          data: { permissions: ['BATCHES_MANAGE'] },
        });
      },
    );

    await t.test(
      'GOVERNANCE receives Marketplace authority while academic-only Admin needs an explicit grant',
      async () => {
        await new AdminMarketplace(db, governor.id).authorize();
        const academicService = new AdminMarketplace(db, academicOnly.id);
        await assert.rejects(() => academicService.authorize(), {
          code: 'FORBIDDEN',
        });
        await db.adminAuthorization.update({
          where: { userId: academicOnly.id },
          data: { permissions: ['ACADEMICS_MANAGE', 'MARKETPLACE_MANAGE'] },
        });
        await academicService.authorize();
        const grantedId = await academicService.save(
          null,
          sample('explicit-marketplace-grant'),
        );
        assert.equal(
          (await academicService.detail(grantedId)).publicationStatus,
          'DRAFT',
        );
        await db.adminAuthorization.update({
          where: { userId: academicOnly.id },
          data: { permissions: ['ACADEMICS_MANAGE'] },
        });
        await assert.rejects(() => academicService.list(), {
          code: 'FORBIDDEN',
        });
      },
    );

    await t.test(
      'permission revoked after entry authorization is rechecked inside the write transaction',
      async () => {
        const revoked = await db.user.create({
          data: {
            clerkUserId: `m1_transaction_revoke_${randomUUID()}`,
            role: 'ADMIN',
            adminAuthorization: {
              create: { permissions: ['MARKETPLACE_MANAGE'] },
            },
          },
        });
        class RevokeBeforeWrite extends AdminMarketplace {
          override async authorize() {
            await super.authorize();
            await db.adminAuthorization.update({
              where: { userId: revoked.id },
              data: { permissions: ['ACADEMICS_MANAGE'] },
            });
          }
        }
        const beforeRows = await db.marketplaceOffering.count();
        const beforeAudits = await db.academicAudit.count();
        await assert.rejects(
          () =>
            new RevokeBeforeWrite(db, revoked.id).save(
              null,
              sample('transaction-revoked'),
            ),
          { code: 'FORBIDDEN' },
        );
        assert.equal(await db.marketplaceOffering.count(), beforeRows);
        assert.equal(await db.academicAudit.count(), beforeAudits);
      },
    );

    await t.test(
      'create always persists a Draft and Admin projection uses an opaque offering reference',
      async () => {
        id = await service.save(null, sample('careerignite-test'));
        assert.equal(typeof id, 'string');
        const row = await db.marketplaceOffering.findUniqueOrThrow({
          where: { id },
        });
        assert.equal(row.publicationStatus, 'DRAFT');
        assert.equal(row.publishedAt, null);
        revision = row.revision;
        const projected = await service.detail(id);
        assert.equal(adminId('offering', projected.ref), id);
        assert.equal(projected.revision, revision);
        assert.ok(!('id' in projected));
        assert.ok(!('courseId' in projected));
        assert.deepEqual((await readPublishedOfferings(db)).offerings, []);
      },
    );

    await t.test(
      'strict creation rejects mass assignment, forged actors, invalid money, unsafe images and invalid catalogue values',
      async () => {
        const invalid = [
          { publicationStatus: 'PUBLISHED' },
          { actorId: actor.id },
          { publishedAt: new Date().toISOString() },
          { revision: randomUUID() },
          { courseId: 'internal-course-id' },
          { priceMinor: -1 },
          { priceMinor: 1.5 },
          { priceMinor: 2147483648 },
          { currency: 'inr' },
          { currency: 'INVALID' },
          { sortOrder: -1 },
          { sortOrder: 100001 },
          { cardImage: 'https://outside.example.test/private' },
          { heroImage: '/images/../../private-secret.webp' },
          { cardImage: '/images/nonexistent.webp' },
          { title: '<script>private</script>' },
          { title: '' },
          { title: 'x'.repeat(161) },
          { slug: 'Uppercase' },
          { slug: 'double--hyphen' },
          { slug: 'x'.repeat(101) },
          { deliveryMode: 'UNKNOWN' },
          { availabilityStatus: 'PUBLISHED' },
          { cohortStartsAt: 'tomorrow' },
        ];
        const before = await db.marketplaceOffering.count();
        for (const fields of invalid) {
          await assert.rejects(
            service.save(null, {
              ...sample(`invalid-${randomUUID()}`),
              ...fields,
            }),
            { code: 'INVALID_INPUT' },
          );
        }
        assert.equal(await db.marketplaceOffering.count(), before);
      },
    );

    await t.test(
      'draft editing preserves Draft, advances revision and rejects duplicate slugs and stale writes',
      async () => {
        const firstRevision = revision;
        await service.save(id, {
          ...sample('careerignite-test'),
          title: 'Updated CareerIgnite',
          revision,
        });
        const row = await db.marketplaceOffering.findUniqueOrThrow({
          where: { id },
        });
        assert.equal(row.title, 'Updated CareerIgnite');
        assert.equal(row.publicationStatus, 'DRAFT');
        assert.notEqual(row.revision, firstRevision);
        revision = row.revision;
        await assert.rejects(
          service.save(id, {
            ...sample('careerignite-test'),
            revision: firstRevision,
          }),
          { code: 'CONFLICT' },
        );
        await assert.rejects(service.save(null, sample('careerignite-test')), {
          code: 'CONFLICT',
        });
        assert.equal(
          (await service.list({ status: 'DRAFT', q: 'Updated CareerIgnite' }))
            .rows[0].ref,
          adminHandle('offering', id),
        );
      },
    );

    await t.test(
      'drafts may be incomplete but cannot publish without required public metadata',
      async () => {
        const incompleteId = await service.save(null, {
          ...sample('incomplete'),
          shortDescription: '',
          category: '',
          durationLabel: '',
        });
        const incomplete = await service.detail(incompleteId);
        await assert.rejects(
          service.publish(incompleteId, { revision: incomplete.revision }),
          { code: 'INVALID_INPUT' },
        );
        assert.equal(
          (await service.detail(incompleteId)).publicationStatus,
          'DRAFT',
        );
      },
    );

    await t.test(
      'publish is explicit, sets publishedAt and keeps availability independent',
      async () => {
        await assert.rejects(service.publish(id, { revision: randomUUID() }), {
          code: 'CONFLICT',
        });
        await service.publish(id, { revision });
        const row = await db.marketplaceOffering.findUniqueOrThrow({
          where: { id },
        });
        assert.equal(row.publicationStatus, 'PUBLISHED');
        assert.ok(row.publishedAt);
        assert.notEqual(row.revision, revision);
        revision = row.revision;
        await assert.rejects(service.publish(id, { revision }), {
          code: 'CONFLICT',
        });
        const all = await readPublishedOfferings(db);
        assert.equal(all.total, 1);
        assert.equal(all.offerings[0].availabilityStatus, 'COMING_SOON');
        assert.equal(all.offerings[0].priceMinor, 1500000);
        assert.equal(
          (await readPublishedOfferings(db, { featured: true, limit: 6 }))
            .offerings[0].slug,
          all.offerings[0].slug,
        );
      },
    );

    await t.test(
      'public readers whitelist exact presentation fields and exclude all Draft records',
      async () => {
        await service.save(null, sample('draft-hidden'));
        const all = await readPublishedOfferings(db);
        assert.equal(all.total, 1);
        assert.deepEqual(Object.keys(all.offerings[0]).sort(), [
          'availabilityStatus',
          'cardImage',
          'category',
          'cohortStartsAt',
          'currency',
          'deliveryMode',
          'durationLabel',
          'heroImage',
          'priceMinor',
          'shortDescription',
          'slug',
          'title',
        ]);
        for (const key of [
          'id',
          'ref',
          'revision',
          'courseId',
          'courseRef',
          'lmsEnabled',
          'createdAt',
          'updatedAt',
          'publicationStatus',
          'featured',
          'sortOrder',
        ]) {
          assert.ok(!(key in all.offerings[0]), key);
        }
        assert.ok(
          !all.offerings.some((offering) => offering.slug === 'draft-hidden'),
        );
      },
    );

    await t.test(
      'published metadata remains complete and status cannot be assigned through an edit',
      async () => {
        await assert.rejects(
          service.save(id, {
            ...sample('careerignite-test'),
            shortDescription: '',
            revision,
          }),
          { code: 'INVALID_INPUT' },
        );
        await assert.rejects(
          service.save(id, {
            ...sample('careerignite-test'),
            publicationStatus: 'ARCHIVED',
            revision,
          }),
          { code: 'INVALID_INPUT' },
        );
        assert.equal((await service.detail(id)).revision, revision);
      },
    );

    await t.test(
      'exactly one concurrent write wins and a stale revision cannot unpublish it',
      async () => {
        const oldRevision = revision;
        const results = await Promise.allSettled([
          service.save(id, {
            ...sample('careerignite-test'),
            title: 'Concurrent one',
            revision,
          }),
          service.save(id, {
            ...sample('careerignite-test'),
            title: 'Concurrent two',
            revision,
          }),
        ]);
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        const rejected = results.filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected',
        );
        assert.equal(rejected.length, 1);
        assert.equal(rejected[0].reason.code, 'CONFLICT');
        revision = (await service.detail(id)).revision;
        assert.notEqual(revision, oldRevision);
        await assert.rejects(service.unpublish(id, { revision: oldRevision }), {
          code: 'CONFLICT',
        });
      },
    );

    await t.test(
      'unpublish immediately hides the offering while preserving content and publication history',
      async () => {
        const before = await db.marketplaceOffering.findUniqueOrThrow({
          where: { id },
        });
        await service.unpublish(id, { revision });
        const row = await db.marketplaceOffering.findUniqueOrThrow({
          where: { id },
        });
        assert.equal(row.publicationStatus, 'UNPUBLISHED');
        assert.deepEqual(row.publishedAt, before.publishedAt);
        assert.equal(row.title, before.title);
        assert.equal(row.slug, before.slug);
        revision = row.revision;
        assert.equal((await readPublishedOfferings(db)).total, 0);
        assert.equal(
          (await readPublishedOfferings(db, { featured: true, limit: 6 }))
            .total,
          0,
        );
        assert.equal((await service.list({ status: 'UNPUBLISHED' })).total, 1);
        await assert.rejects(service.unpublish(id, { revision }), {
          code: 'CONFLICT',
        });
      },
    );

    await t.test(
      'archiving preserves the record and denies later edits or republication',
      async () => {
        const countBefore = await db.marketplaceOffering.count();
        await service.archive(id, { revision });
        const row = await service.detail(id);
        assert.equal(row.publicationStatus, 'ARCHIVED');
        assert.ok(row.publishedAt);
        revision = row.revision;
        assert.equal(await db.marketplaceOffering.count(), countBefore);
        assert.equal((await readPublishedOfferings(db)).total, 0);
        await assert.rejects(service.publish(id, { revision }), {
          code: 'CONFLICT',
        });
        await assert.rejects(
          service.save(id, { ...sample('careerignite-test'), revision }),
          { code: 'CONFLICT' },
        );
        assert.equal((await service.list({ status: 'ARCHIVED' })).total, 1);
      },
    );

    await t.test(
      'LMS-disabled offerings can publish without a course and preserve a null configured price',
      async () => {
        const independentId = await service.save(null, {
          ...sample('independent'),
          priceMinor: null,
          featured: false,
        });
        const before = await service.detail(independentId);
        assert.equal(before.courseRef, null);
        await service.publish(independentId, { revision: before.revision });
        const publicRows = await readPublishedOfferings(db);
        assert.equal(
          publicRows.offerings.find((row) => row.slug === 'independent')
            ?.priceMinor,
          null,
        );
        assert.equal(
          (await readPublishedOfferings(db, { featured: true, limit: 6 }))
            .total,
          0,
        );
      },
    );

    await t.test(
      'enabled drafts allow an optional course but publication requires an existing canonical course',
      async () => {
        const optionalId = await service.save(null, {
          ...sample('lms-optional'),
          lmsEnabled: true,
        });
        let row = await service.detail(optionalId);
        await assert.rejects(
          service.publish(optionalId, { revision: row.revision }),
          { code: 'INVALID_INPUT' },
        );
        const course = await db.course.create({
          data: {
            title: 'Canonical LMS',
            description: 'Existing learning',
            thumbnailPath: '/images/campus.webp',
            thumbnailAlt: 'Campus',
            publicPath: '/#programs',
          },
        });
        const choice = (await service.courses({ q: 'Canonical' })).find(
          (item) => item.ref === adminHandle('course', course.id),
        );
        assert.ok(choice);
        assert.deepEqual(Object.keys(choice).sort(), ['label', 'ref']);
        await service.save(optionalId, {
          ...sample('lms-optional'),
          lmsEnabled: true,
          courseRef: choice.ref,
          revision: row.revision,
        });
        row = await service.detail(optionalId);
        await service.publish(optionalId, { revision: row.revision });
        assert.equal(await db.enrollment.count(), 0);
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: student.id } }))
            .lmsAccessOverride,
          null,
        );
        assert.deepEqual(
          await db.course.findUniqueOrThrow({ where: { id: course.id } }),
          course,
        );
        await assert.rejects(db.course.delete({ where: { id: course.id } }), {
          code: 'P2003',
        });
      },
    );

    await t.test(
      'disabled links, nonexistent courses and wrong-kind opaque references cannot be persisted',
      async () => {
        const course = await db.course.findFirstOrThrow();
        await assert.rejects(
          service.save(null, {
            ...sample('disabled-link'),
            courseRef: adminHandle('course', course.id),
          }),
          { code: 'INVALID_INPUT' },
        );
        await assert.rejects(
          service.save(null, {
            ...sample('missing-course'),
            lmsEnabled: true,
            courseRef: adminHandle('course', 'unknown'),
          }),
          { code: 'NOT_FOUND' },
        );
        await assert.rejects(
          service.save(null, {
            ...sample('wrong-kind'),
            lmsEnabled: true,
            courseRef: adminHandle('offering', id),
          }),
          { code: 'NOT_FOUND' },
        );
        await assert.rejects(service.detail('unknown'), { code: 'NOT_FOUND' });
      },
    );

    await t.test(
      'pagination, featured filtering and catalogue ordering never leak unpublished rows',
      async () => {
        const { courseRef: omittedCourseRef, ...fields } =
          sample('page-placeholder');
        assert.equal(omittedCourseRef, null);
        await db.marketplaceOffering.createMany({
          data: Array.from({ length: 22 }, (_, index) => ({
            ...fields,
            slug: `page-${index}`,
            id: `page_${index}`,
            revision: randomUUID(),
            publicationStatus: 'PUBLISHED' as const,
            publishedAt: new Date(),
            sortOrder: index + 10,
          })),
        });
        const first = await readPublishedOfferings(db, { page: 1, limit: 20 });
        const second = await readPublishedOfferings(db, { page: 2, limit: 20 });
        assert.equal(first.offerings.length, 20);
        assert.ok(second.offerings.length > 0);
        assert.equal(
          new Set(
            [...first.offerings, ...second.offerings].map((row) => row.slug),
          ).size,
          first.total,
        );
        assert.equal(first.total, second.total);
        const featured = await readPublishedOfferings(db, {
          featured: true,
          limit: 6,
        });
        assert.equal(featured.offerings.length, 6);
        assert.ok(
          !featured.offerings.some((row) => row.slug === 'independent'),
        );
        assert.deepEqual(
          featured.offerings.map((row) => row.slug),
          ['lms-optional', 'page-0', 'page-1', 'page-2', 'page-3', 'page-4'],
        );
        for (const row of [...first.offerings, ...second.offerings])
          assert.ok(
            !['careerignite-test', 'draft-hidden', 'incomplete'].includes(
              row.slug,
            ),
          );
        for (const status of [
          'DRAFT',
          'PUBLISHED',
          'UNPUBLISHED',
          'ARCHIVED',
        ] as const) {
          const view = await service.list({ status });
          assert.ok(view.rows.every((row) => row.publicationStatus === status));
        }
      },
    );

    await t.test(
      'bounded list inputs reject unsupported statuses, filters and invalid pagination',
      async () => {
        for (const query of [
          { status: 'UNKNOWN' },
          { page: '0' },
          { page: '10001' },
          { q: 'x'.repeat(101) },
          { actorId: actor.id },
        ]) {
          await assert.rejects(service.list(query), { code: 'INVALID_INPUT' });
        }
        await assert.rejects(service.courses({ q: 'x'.repeat(101) }), {
          code: 'INVALID_INPUT',
        });
        for (const query of [{ page: 0 }, { limit: 21 }]) {
          await assert.rejects(readPublishedOfferings(db, query), {
            code: 'INVALID_INPUT',
          });
        }
      },
    );

    await t.test(
      'database constraints independently reject invalid price, currency, publication and LMS state',
      async () => {
        const row = await db.marketplaceOffering.findFirstOrThrow({
          where: { publicationStatus: 'PUBLISHED' },
        });
        await assert.rejects(
          db.marketplaceOffering.update({
            where: { id: row.id },
            data: { priceMinor: -1 },
          }),
          rejectsConstraint('marketplace_price'),
        );
        await assert.rejects(
          db.marketplaceOffering.update({
            where: { id: row.id },
            data: { currency: 'invalid' },
          }),
          rejectsConstraint('marketplace_currency'),
        );
        await assert.rejects(
          db.marketplaceOffering.update({
            where: { id: row.id },
            data: { publishedAt: null },
          }),
          rejectsConstraint('marketplace_published'),
        );
        await assert.rejects(
          db.marketplaceOffering.update({
            where: { id: row.id },
            data: { lmsEnabled: true, courseId: null },
          }),
          rejectsConstraint('marketplace_published'),
        );
      },
    );

    await t.test(
      'fresh capability revocation immediately denies reads and sensitive writes',
      async () => {
        const revoked = await db.user.create({
          data: {
            clerkUserId: `m1_revoked_${randomUUID()}`,
            role: 'ADMIN',
            adminAuthorization: {
              create: { permissions: ['MARKETPLACE_MANAGE'] },
            },
          },
        });
        const revokedService = new AdminMarketplace(db, revoked.id);
        const draftId = await revokedService.save(
          null,
          sample('revoked-draft'),
        );
        const draft = await revokedService.detail(draftId);
        await db.adminAuthorization.update({
          where: { userId: revoked.id },
          data: { permissions: [] },
        });
        for (const operation of [
          () => revokedService.list(),
          () => revokedService.detail(draftId),
          () =>
            revokedService.save(draftId, {
              ...sample('revoked-draft'),
              revision: draft.revision,
            }),
          () => revokedService.publish(draftId, { revision: draft.revision }),
        ])
          await assert.rejects(operation, { code: 'FORBIDDEN' });
        assert.equal((await service.detail(draftId)).revision, draft.revision);
      },
    );

    await t.test(
      'audit insertion failure rolls back both catalogue data and revision changes',
      async () => {
        const before = await db.marketplaceOffering.findUniqueOrThrow({
          where: { id },
        });
        const beforeCount = await db.marketplaceOffering.count();
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${fixture.schema}".reject_m1_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'M1 fixture audit failure'; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER m1_audit_failure BEFORE INSERT ON "${fixture.schema}"."AcademicAudit" FOR EACH ROW EXECUTE FUNCTION "${fixture.schema}".reject_m1_audit()`,
        );
        try {
          await assert.rejects(service.save(null, sample('audit-rollback')));
          const draft = await db.marketplaceOffering.findFirstOrThrow({
            where: { publicationStatus: 'DRAFT' },
          });
          await assert.rejects(
            service.save(draft.id, {
              ...sample(draft.slug),
              title: 'Must roll back',
              revision: draft.revision,
            }),
          );
          assert.deepEqual(
            await db.marketplaceOffering.findUniqueOrThrow({
              where: { id: draft.id },
            }),
            draft,
          );
          assert.equal(await db.marketplaceOffering.count(), beforeCount);
          assert.deepEqual(
            await db.marketplaceOffering.findUniqueOrThrow({ where: { id } }),
            before,
          );
        } finally {
          await db.$executeRawUnsafe(
            `DROP TRIGGER m1_audit_failure ON "${fixture.schema}"."AcademicAudit"`,
          );
        }
      },
    );

    await t.test(
      'marketplace audit events use safe nonempty summaries and preserve immutable history',
      async () => {
        const audits = await db.academicAudit.findMany({
          where: { action: { startsWith: 'MarketplaceOffering' } },
        });
        for (const action of [
          'MarketplaceOfferingCreated',
          'MarketplaceOfferingUpdated',
          'MarketplaceOfferingPublished',
          'MarketplaceOfferingUnpublished',
          'MarketplaceOfferingArchived',
        ]) {
          assert.ok(
            audits.some((audit) => audit.action === action),
            action,
          );
          assert.equal(auditRegistry[action].category, 'Marketplace');
        }
        assert.deepEqual(
          safeAuditSummary('MarketplaceOfferingPublished', {
            publicationBefore: 'DRAFT',
            publicationAfter: 'PUBLISHED',
            lmsEnabled: false,
            assetRef: 'private',
            courseId: 'private',
            offeringId: 'private',
            reason: 'private',
          }),
          [
            'publication Before: DRAFT',
            'publication After: PUBLISHED',
            'lms Enabled: No',
          ],
        );
        await assert.rejects(
          db.academicAudit.delete({ where: { id: audits[0].id } }),
        );
        assert.equal(await db.enrollment.count(), 0);
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: student.id } }))
            .lmsAccessOverride,
          null,
        );
      },
    );

    const migrations = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) AS count FROM "${fixture.schema}"."_prisma_migrations"`,
    );
    assert.equal(Number(migrations[0].count), migrationCount());
  } finally {
    await fixture.cleanup();
  }
});

test('M1 upgrades a populated approved baseline without changing existing learning data', async () => {
  const fixture = await isolatedDatabase(
    undefined,
    '20261101093000_student_id_prefix_st',
  );
  try {
    const user = await fixture.db.user.create({
      data: { clerkUserId: 'm1_historical' },
    });
    const course = await fixture.db.course.create({
      data: {
        title: 'Historical course',
        description: 'Preserved',
        thumbnailPath: '/images/campus.webp',
        thumbnailAlt: 'Campus',
        publicPath: '/#programs',
      },
    });
    const enrollment = await fixture.db.enrollment.create({
      data: { userId: user.id, courseId: course.id },
    });
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: fixture.url }, stdio: 'pipe' },
    );
    assert.deepEqual(
      await fixture.db.user.findUniqueOrThrow({ where: { id: user.id } }),
      user,
    );
    assert.deepEqual(
      await fixture.db.course.findUniqueOrThrow({ where: { id: course.id } }),
      course,
    );
    assert.deepEqual(
      await fixture.db.enrollment.findUniqueOrThrow({
        where: { id: enrollment.id },
      }),
      enrollment,
    );
    assert.equal(await fixture.db.marketplaceOffering.count(), 0);
  } finally {
    await fixture.cleanup();
  }
});

test('Marketplace permission migration is additive, grants no persisted policy and preserves original M1 SQL', () => {
  const sql = readFileSync(
    'prisma/migrations/20261118100000_marketplace_permission/migration.sql',
    'utf8',
  );
  const statements = sql
    .replace(/--[^\n]*/g, '')
    .trim()
    .split(';')
    .filter((part) => part.trim());
  assert.equal(statements.length, 1);
  assert.match(
    statements[0],
    /^ALTER TYPE "AdminPermission" ADD VALUE 'MARKETPLACE_MANAGE'$/,
  );
});
