import { AdminBatchDetail } from '@/components/admin/BatchDetail';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  return <AdminBatchDetail refId={(await params).ref} />;
}
