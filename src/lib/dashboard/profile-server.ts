import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { requireStudentIdentity } from '../auth/session';
import type { StudentProfile } from './profile';
export async function requireStudentProfile(): Promise<StudentProfile> {
  const identity = await requireStudentIdentity();
  const user = await currentUser();
  return {
    ...identity,
    lastName: user?.lastName || null,
    phone:
      user?.phoneNumbers.find((phone) => phone.id === user.primaryPhoneNumberId)
        ?.phoneNumber || null,
    education: null,
  };
}
