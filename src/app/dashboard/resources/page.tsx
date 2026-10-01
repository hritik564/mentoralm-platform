import { ResourceLibrary } from '@/components/dashboard/resources/ResourceLibrary';
import { getResources } from '@/lib/student/services';
import { requireStudentIdentity } from '@/lib/auth/session';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';
export const metadata = { title: 'Resources' };
export default async function Page() {
  await requireStudentIdentity();
  return (
    <DashboardDataBoundary
      load={async () => {
        const data = await getResources();
        return <ResourceLibrary {...data} />;
      }}
    />
  );
}
