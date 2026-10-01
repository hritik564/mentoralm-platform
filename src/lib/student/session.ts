import 'server-only';
import { isAuthConfigured } from '../auth/config';
import { auth } from '@clerk/nextjs/server';
import { cache } from 'react';
import { getDatabase } from '../db/client';
import { provisionUser, StudentRepository } from './repository';
import { StudentError } from './errors';
export const getCurrentStudent = cache(async () => {
  if (!isAuthConfigured()) throw new StudentError('UNAUTHENTICATED');
  const { userId } = await auth();
  if (!userId) throw new StudentError('UNAUTHENTICATED');
  try {
    return await provisionUser(getDatabase(), userId);
  } catch (error) {
    if (error instanceof StudentError) throw error;
    console.error('student_provisioning_unavailable');
    throw new StudentError('UNAVAILABLE');
  }
});
export async function studentRepository() {
  const actor = await getCurrentStudent();
  return new StudentRepository(getDatabase(), actor);
}
