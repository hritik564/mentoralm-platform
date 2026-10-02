import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { requireAdmin } from '../auth/roles';
import { cache } from 'react';
import { getDatabase } from '../db/client';
import { isAuthConfigured } from '../auth/config';
import { StudentError } from '../student/errors';
export const requireAdminActor = cache(async () => {
  if (!isAuthConfigured()) throw new StudentError('UNAUTHENTICATED');
  const { userId } = await auth();
  if (!userId) throw new StudentError('UNAUTHENTICATED');
  const actor = await getDatabase().user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, role: true },
  });
  if (!actor) throw new StudentError('FORBIDDEN');
  await requireAdmin(getDatabase(), actor.id);
  return actor;
});
