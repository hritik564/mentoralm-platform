import { OperationalMetrics } from '@/components/admin/operational/List';
import { AdminOverview } from '@/components/admin/Lists';
export default function Page() {
  return (
    <>
      <AdminOverview />
      <OperationalMetrics />
    </>
  );
}
