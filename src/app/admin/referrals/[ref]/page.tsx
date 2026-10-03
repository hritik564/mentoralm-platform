import { ReferralDetail } from '@/components/admin/operational/Conversations';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <ReferralDetail reference={ref} />;
}
