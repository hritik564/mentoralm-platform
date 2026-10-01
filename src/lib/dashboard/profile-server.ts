import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { requireStudentIdentity } from '../auth/session';
import { getProfile } from '../student/services';
import type { StudentProfile } from './profile';
export async function requireStudentProfile(): Promise<StudentProfile> {
  const identity = await requireStudentIdentity();
  const user = await currentUser();
  const education = await getProfile();
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
