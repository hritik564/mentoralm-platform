import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { requireStudentIdentity } from '@/lib/auth/session';
export const metadata = { title: 'Referral' };
export default async function Page() {
  await requireStudentIdentity();
  return <DashboardEmptyState area="referral" />;
}
