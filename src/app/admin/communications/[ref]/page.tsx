import { CommunicationDetail } from '@/components/admin/operational/Communications';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <CommunicationDetail reference={ref} />;
}
