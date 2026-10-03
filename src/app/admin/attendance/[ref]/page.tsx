import { AttendanceSession } from '@/components/admin/operational/Attendance';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <AttendanceSession reference={ref} />;
}
