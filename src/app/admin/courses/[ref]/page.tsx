import { CourseBuilder } from '@/components/admin/academic/Builder';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  return <CourseBuilder courseRef={(await params).ref} />;
}
