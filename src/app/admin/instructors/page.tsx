import { Suspense } from 'react';
import { Users } from '@/components/admin/governance/Views';
export default function Page() {
  return (
    <Suspense>
      <Users instructors />
    </Suspense>
  );
}
