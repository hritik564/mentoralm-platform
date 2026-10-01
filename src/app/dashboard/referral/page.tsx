import { ReferralPage } from '@/components/dashboard/referral/ReferralPage';
import { getReferral } from '@/lib/student/services';
import { requireStudentIdentity } from '@/lib/auth/session';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';
export const metadata = { title: 'Referral' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  await requireStudentIdentity();
  const inviteCode = (await searchParams).invite;
  return (
    <DashboardDataBoundary
      load={async () => {
        const data = await getReferral();
        return <ReferralPage {...data} inviteCode={inviteCode} />;
      }}
    />
  );
}
