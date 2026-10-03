import { SupportTicket } from '@/components/admin/operational/Conversations';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <SupportTicket reference={ref} />;
}
