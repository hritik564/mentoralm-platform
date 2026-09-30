import { SupportPage } from '@/components/dashboard/support/SupportPage';
import { getStudentTickets } from '@/lib/dashboard/support';
import { requireStudentIdentity } from '@/lib/auth/session';
export const metadata = { title: 'Support' };
export default async function Page() {
  await requireStudentIdentity();
  return <SupportPage tickets={getStudentTickets()} />;
}
