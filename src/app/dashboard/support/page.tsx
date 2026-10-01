import { SupportPage } from '@/components/dashboard/support/SupportPage';
import { getTickets } from '@/lib/student/services';
import { requireStudentIdentity } from '@/lib/auth/session';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';
export const metadata = { title: 'Support' };
export default async function Page() {
  await requireStudentIdentity();
  return (
    <DashboardDataBoundary
      load={async () => {
        return <SupportPage tickets={await getTickets()} />;
      }}
    />
  );
}
