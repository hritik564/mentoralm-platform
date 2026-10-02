import { QuestionBank } from '@/components/admin/academic/Questions';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  return <QuestionBank bankRef={(await params).ref} />;
}
