import { auditTargetDescriptions } from './audit-targets';
import 'server-only';
import { Prisma } from '../../../generated/prisma/client';
import { GovernanceAccess, accessState, governanceTransaction } from './access';
import {
  requireAdminPermission,
  adminCapabilities,
} from '../../auth/admin-policy';
import { listParams, dates } from '../operational/queries';
import { adminHandle as h } from '../handles';
import { StudentError, errorMessages } from '../../student/errors';
import { getEffectiveRoles, hasRole } from '../../auth/roles';
import {
  auditRegistry,
  safeAuditAction,
  safeAuditSummary,
} from './audit-projection';
import { z } from 'zod';
import { LmsAccessAdmin } from '../../lms/access-admin';
import { parseInput } from '../validation';
export class GovernanceRepository extends GovernanceAccess {
  async users(q: Record<string, string | undefined> = {}, instructors = false) {
    await requireAdminPermission(
      this.db,
      this.actorId,
      instructors ? 'BATCHES_MANAGE' : 'USERS_VIEW',
    );
    const p = listParams(q);
    if (q.persona && !['STUDENT', 'ADMIN', 'INSTRUCTOR'].includes(q.persona))
      throw new StudentError('INVALID_INPUT');
    if (q.role && !['STUDENT', 'ADMIN', 'INSTRUCTOR'].includes(q.role))
      throw new StudentError('INVALID_INPUT');
    const ids = p.search ? await this.directory.search(p.search) : [];
    const where: Prisma.UserWhereInput = {
      AND: [
        ...(instructors
          ? [
              {
                OR: [
                  { role: 'INSTRUCTOR' as const },
                  {
                    roleAssignments: { some: { role: 'INSTRUCTOR' as const } },
                  },
                ],
              },
            ]
          : []),
        ...(q.persona ? [{ role: q.persona as 'STUDENT' }] : []),
        ...(q.role
          ? [
              {
                OR: [
                  { role: q.role as 'ADMIN' },
                  { roleAssignments: { some: { role: q.role as 'ADMIN' } } },
                ],
              },
            ]
          : []),
        ...(p.search
          ? [
              {
                OR: [
                  {
                    studentId: {
                      contains: p.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  { clerkUserId: { in: ids } },
                ],
              },
            ]
          : []),
      ],
    };
    const [rows, total] = await Promise.all([
      this.db.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: p.skip,
        take: 20,
        include: {
          roleAssignments: { select: { role: true } },
          adminAuthorization: true,
          teaching: {
            include: { batch: { select: { name: true, code: true } } },
          },
          _count: { select: { enrollments: true, memberships: true } },
        },
      }),
      this.db.user.count({ where }),
    ]);
    const identities = await this.directory.lookup(
      rows.map((u) => u.clerkUserId),
    );
    return {
      page: p.page,
      total,
      rows: rows.map((u) => ({
        ref: h('user', u.id),
        name: identities.get(u.clerkUserId)?.name || 'Identity unavailable',
        email: identities.get(u.clerkUserId)?.email || '',
        status: identities.get(u.clerkUserId)?.status || 'Unavailable',
        primaryRole: u.role,
        additionalRoles: u.roleAssignments.map((a) => a.role),
        studentId: u.studentId,
        authority: !hasRole(
          {
            id: u.id,
            primaryRole: u.role,
            roles: new Set([u.role, ...u.roleAssignments.map((r) => r.role)]),
          },
          'ADMIN',
        )
          ? null
          : u.adminAuthorization?.authority || null,
        lms:
          u.role === 'STUDENT'
            ? u.lmsAccessOverride || 'INHERITED'
            : 'Not a Student persona',
        enrollments: u._count.enrollments,
        memberships: u._count.memberships,
        teachingEligible: u.role === 'INSTRUCTOR',
        teaching: u.teaching.map((a) => ({
          name: a.batch.name,
          code: a.batch.code,
        })),
      })),
    };
  }
  async user(targetId: string) {
    await requireAdminPermission(this.db, this.actorId, 'USERS_VIEW');
    const { user, state } = await accessState(this.db, targetId),
      c = await adminCapabilities(this.db, this.actorId);
    const identity = (await this.directory.lookup([user.clerkUserId])).get(
      user.clerkUserId,
    );
    return {
      ref: h('user', user.id),
      identity: identity
        ? {
            name: identity.name,
            email: identity.email,
            status: identity.status,
          }
        : { name: 'Identity unavailable', email: '', status: 'Unavailable' },
      primaryRole: user.role,
      additionalRoles: user.roleAssignments.map((r) => r.role),
      studentId: user.studentId,
      state,
      policy: user.adminAuthorization
        ? {
            authority: user.adminAuthorization.authority,
            permissions: user.adminAuthorization.permissions,
            revision: user.adminAuthorization.revision,
          }
        : null,
      canManage: c.authority === 'GOVERNANCE',
      isSelf: user.id === this.actorId,
      hasAdmin: hasRole(await getEffectiveRoles(this.db, targetId), 'ADMIN'),
      instructorEligibility:
        user.role === 'INSTRUCTOR'
          ? 'Eligible for Batch assignment'
          : 'Additional INSTRUCTOR alone does not grant teaching eligibility; primary INSTRUCTOR is required.',
    };
  }
  async audit(q: Record<string, string | undefined> = {}) {
    await requireAdminPermission(this.db, this.actorId, 'AUDIT_VIEW');
    const p = listParams(q),
      range = dates(q),
      known = Object.keys(auditRegistry);
    if (
      q.category &&
      !Object.values(auditRegistry).some((v) => v.category === q.category) &&
      q.category !== 'Unknown'
    )
      throw new StudentError('INVALID_INPUT');
    if (
      q.target &&
      !Object.values(auditRegistry).some((v) => v.target === q.target)
    )
      throw new StudentError('INVALID_INPUT');
    if (q.action && !auditRegistry[q.action])
      throw new StudentError('INVALID_INPUT');
    const selected = known.filter(
      (a) =>
        (!q.category || auditRegistry[a].category === q.category) &&
        (!q.target || auditRegistry[a].target === q.target),
    );
    const where: Prisma.AcademicAuditWhereInput = {
      ...(Object.keys(range).length ? { createdAt: range } : {}),
      ...(q.actor ? { actorId: q.actor } : {}),
      AND: [
        ...(q.action ? [{ action: q.action }] : []),
        ...(q.category === 'Unknown' ? [{ action: { notIn: known } }] : []),
        ...((q.category && q.category !== 'Unknown') || q.target
          ? [{ action: { in: selected } }]
          : []),
      ],
    };
    const [rows, total] = await Promise.all([
      this.db.academicAudit.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: p.skip,
        take: 20,
        include: { actor: { select: { clerkUserId: true } } },
      }),
      this.db.academicAudit.count({ where }),
    ]);
    const identities = await this.directory.lookup([
      ...new Set(rows.map((r) => r.actor.clerkUserId)),
    ]);
    const targets = await auditTargetDescriptions(
      this.db,
      rows,
      this.directory,
    );
    return {
      page: p.page,
      total,
      filters: {
        actions: known.map((a) => ({ value: a, label: safeAuditAction(a) })),
        categories: [
          ...new Set(Object.values(auditRegistry).map((v) => v.category)),
          'Unknown',
        ],
        targets: [
          ...new Set(Object.values(auditRegistry).map((v) => v.target)),
        ],
      },
      rows: rows.map((r) => ({
        ref: h('audit', r.id),
        actor:
          identities.get(r.actor.clerkUserId)?.name || 'Identity unavailable',
        actorRef: h('user', r.actorId),
        action: safeAuditAction(r.action),
        category: auditRegistry[r.action]?.category || 'Unknown',
        target: auditRegistry[r.action]?.target || null,
        targetDescription: targets.get(r.id) || null,
        at: r.createdAt.toISOString(),
        summary: safeAuditSummary(r.action, r.details),
      })),
    };
  }
  async settings() {
    await requireAdminPermission(this.db, this.actorId, 'SETTINGS_VIEW');
    const dev = process.env.CLERK_SECRET_KEY?.startsWith('sk_test_');
    return {
      groups: [
        {
          name: 'Platform',
          rows: [
            ['Public website', 'mentoralm.com'],
            ['Student LMS', 'students.mentoralm.com'],
            ['Admin Console', 'admin.mentoralm.com'],
            ['DNS / TLS', 'Production action required'],
          ],
        },
        {
          name: 'Learning',
          rows: [
            ['Completion / certificates', 'Course-specific policy'],
            ['Certificate renderer', 'Not configured'],
            ['Zoom automation', 'Not configured'],
          ],
        },
        {
          name: 'Communications',
          rows: [
            ['Email provider', 'Not configured'],
            ['WhatsApp provider', 'Not configured'],
            ['In-app delivery', 'Not configured'],
            ['Planning', 'Configured; consent required'],
          ],
        },
        {
          name: 'Media',
          rows: [
            [
              'Private filesystem',
              process.env.LMS_FILES_ROOT
                ? 'Development only'
                : 'Not configured',
            ],
            ['Private object storage', 'Not configured'],
            ['Streaming provider', 'Not configured'],
            ['Malware scanning', 'Not configured'],
          ],
        },
        {
          name: 'Security',
          rows: [
            [
              'Clerk',
              dev
                ? 'Development only'
                : process.env.CLERK_SECRET_KEY
                  ? 'Configured'
                  : 'Not configured',
            ],
            [
              'Database',
              'Configured; Production readiness requires operator verification',
            ],
            ['Rate limiting', 'Development only; distributed limiter required'],
            ['Audit writes', 'Append-only'],
            [
              'Provider / backup / observability readiness',
              'Production action required',
            ],
          ],
        },
      ],
    };
  }
  async bulk(input: unknown) {
    const c = parseInput(
      z
        .object({
          users: z
            .array(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/))
            .min(1)
            .max(50)
            .refine((ids) => new Set(ids).size === ids.length),
          value: z.enum(['ENABLED', 'DISABLED', 'INHERIT']),
          confirmation: z.literal(true),
          reason: z.string().trim().min(1).max(500),
        })
        .strict(),
      input,
    );
    await requireAdminPermission(this.db, this.actorId, 'STUDENTS_MANAGE');
    const results = [];
    for (const userId of c.users) {
      try {
        await new LmsAccessAdmin(this.db, this.actorId).change(
          {
            kind: 'STUDENT_OVERRIDE',
            userId,
            value: c.value === 'INHERIT' ? null : c.value,
          },
          c.reason,
        );
        results.push({ ref: h('student', userId), saved: true, error: null });
      } catch (error) {
        if (!(error instanceof StudentError)) throw error;
        await governanceTransaction(this.db, async (tx) => {
          await requireAdminPermission(tx, this.actorId, 'STUDENTS_MANAGE');
          await tx.academicAudit.create({
            data: {
              actorId: this.actorId,
              targetId: userId,
              action: 'BulkLmsAccessFailed',
              details: { reason: c.reason, outcome: error.code },
            },
          });
        });
        results.push({
          ref: h('student', userId),
          saved: false,
          error: errorMessages[error.code],
        });
      }
    }
    return { results };
  }
}
