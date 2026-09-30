import { ReferralPage } from '@/components/dashboard/referral/ReferralPage';
import { getStudentReferral } from '@/lib/dashboard/referral';
import { requireStudentIdentity } from '@/lib/auth/session';
export const metadata = { title: 'Referral' };
export default async function Page() {
  await requireStudentIdentity();
  return <ReferralPage summary={getStudentReferral()} />;
}
