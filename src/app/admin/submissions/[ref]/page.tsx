import { AssignmentReview } from '@/components/admin/operational/Reviews';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <AssignmentReview reference={ref} />;
}
