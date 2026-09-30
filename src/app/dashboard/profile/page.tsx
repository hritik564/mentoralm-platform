import { StudentProfilePage } from '@/components/dashboard/profile/StudentProfilePage';
import { requireStudentProfile } from '@/lib/dashboard/profile-server';
export const metadata = { title: 'Profile' };
export default async function Page() {
  return <StudentProfilePage profile={await requireStudentProfile()} />;
}
