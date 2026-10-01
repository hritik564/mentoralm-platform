import { StudentProfilePage } from '@/components/dashboard/profile/StudentProfilePage';
import { requireStudentProfile } from '@/lib/dashboard/profile-server';
import { requireStudentIdentity } from '@/lib/auth/session';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';
export const metadata = { title: 'Profile' };
export default async function Page() {
  await requireStudentIdentity();
  return (
    <DashboardDataBoundary
      load={async () => (
        <StudentProfilePage profile={await requireStudentProfile()} />
      )}
    />
  );
}
