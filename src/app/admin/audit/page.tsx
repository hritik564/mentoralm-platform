import { Suspense } from 'react';
import { Audit } from '@/components/admin/governance/Views';
export default function Page() {
  return (
    <Suspense>
      <Audit />
    </Suspense>
  );
}
