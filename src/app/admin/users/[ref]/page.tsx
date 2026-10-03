import { UserDetail } from '@/components/admin/governance/Views';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  return <UserDetail refId={(await params).ref} />;
}
