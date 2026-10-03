import { Suspense } from 'react';
import { Settings } from '@/components/admin/governance/Views';
export default function Page() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
