import { AdminStudentDetail } from '@/components/admin/StudentDetail';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  return <AdminStudentDetail refId={(await params).ref} />;
}
