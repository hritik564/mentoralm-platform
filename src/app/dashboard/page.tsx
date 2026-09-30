import { requireStudentIdentity } from '@/lib/auth/session';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
export default async function OverviewPage() {
  return <DashboardOverview user={await requireStudentIdentity()} />;
}
