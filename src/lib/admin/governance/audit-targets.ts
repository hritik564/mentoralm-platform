import 'server-only';
import type { Prisma } from '../../../generated/prisma/client';
import type { Directory } from '../directory';
import { auditRegistry } from './audit-projection';
/** Resolve only registered target meanings. Never infer a model from an unknown action or raw details. */
export async function auditTargetDescriptions(
  db: Prisma.TransactionClient,
  rows: { id: string; action: string; targetId: string }[],
  directory: Directory,
) {
  const descriptions = new Map<string, string>();
  const ids = (kind: string) => [
    ...new Set(
      rows
        .filter((r) => auditRegistry[r.action]?.target === kind)
        .map((r) => r.targetId),
    ),
  ];
  const users = await db.user.findMany({
      where: { id: { in: ids('User') } },
      select: { id: true, clerkUserId: true, studentId: true },
    }),
    identities = await directory.lookup(users.map((u) => u.clerkUserId));
  const names = new Map(
    users.map((u) => [
      u.id,
      `${identities.get(u.clerkUserId)?.name || 'Identity unavailable'}${u.studentId ? ` · ${u.studentId}` : ''}`.slice(
        0,
        160,
      ),
    ]),
  );
  for (const r of rows)
    if (auditRegistry[r.action]?.target === 'User' && names.has(r.targetId))
      descriptions.set(r.id, names.get(r.targetId)!);
  for (const kind of [
    'Batch',
    'Live Session',
    'Course',
    'Program',
    'Section',
    'Learning item',
  ] as const) {
    const targetIds = ids(kind);
    if (!targetIds.length) continue;
    const where = { id: { in: targetIds } };
    const targets =
      kind === 'Batch'
        ? (
            await db.batch.findMany({
              where,
              select: { id: true, name: true, code: true },
            })
          ).map((b) => ({ id: b.id, label: `${b.name} · ${b.code}` }))
        : kind === 'Live Session'
          ? await db.batchSession.findMany({
              where,
              select: { id: true, title: true },
            })
          : kind === 'Course'
            ? await db.course.findMany({
                where,
                select: { id: true, title: true },
              })
            : kind === 'Program'
              ? await db.program.findMany({
                  where,
                  select: { id: true, title: true },
                })
              : kind === 'Section'
                ? await db.section.findMany({
                    where,
                    select: { id: true, title: true },
                  })
                : await db.learningItem.findMany({
                    where,
                    select: { id: true, title: true },
                  });
    const labels = new Map(
      targets.map((t) => [
        t.id,
        ('label' in t ? t.label : t.title).slice(0, 160),
      ]),
    );
    for (const r of rows)
      if (auditRegistry[r.action]?.target === kind && labels.has(r.targetId))
        descriptions.set(r.id, labels.get(r.targetId)!);
  }
  return descriptions;
}
