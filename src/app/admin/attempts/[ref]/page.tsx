import { AttemptReview } from '@/components/admin/operational/Reviews';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <AttemptReview reference={ref} />;
}
