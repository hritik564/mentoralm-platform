import 'server-only';
import { learnerProfile } from '../lms/profile';
import { getCurrentStudent } from '../student/session';
import { getDatabase } from '../db/client';
import { currentUser } from '@clerk/nextjs/server';
import { requireStudentIdentity } from '../auth/session';
import { getProfile } from '../student/services';
import type { StudentProfile } from './profile';
export async function requireStudentProfile(
  surface: 'dashboard' | 'lms' = 'dashboard',
): Promise<StudentProfile> {
  const identity = await requireStudentIdentity();
  const user = await currentUser();
  const education =
    surface === 'lms'
      ? await learnerProfile(getDatabase(), (await getCurrentStudent()).id)
      : await getProfile();
  return {
    ...identity,
    lastName: user?.lastName || null,
    phone:
      user?.phoneNumbers.find((phone) => phone.id === user.primaryPhoneNumberId)
        ?.phoneNumber || null,
    education: education
      ? {
          level: education.educationLevel,
          institution: education.institution,
          graduationYear: education.graduationYear,
          interests: education.interests,
          careerGoals: education.careerGoals,
        }
      : null,
  };
}
