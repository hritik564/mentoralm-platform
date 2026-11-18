import { MarketplaceEditor } from '@/components/admin/marketplace/MarketplaceEditor';

export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  return <MarketplaceEditor refId={(await params).ref} />;
}
