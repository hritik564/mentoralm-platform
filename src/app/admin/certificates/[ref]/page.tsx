import { CertificateDetail } from '@/components/admin/operational/Certificates';
export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <CertificateDetail reference={ref} />;
}
