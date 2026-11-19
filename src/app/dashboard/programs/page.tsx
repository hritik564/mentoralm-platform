import { MyPrograms } from '@/components/marketplace/delivery/MyPrograms';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';
import { getCurrentStudent } from '@/lib/student/session';
import { getDatabase } from '@/lib/db/client';
import { MarketplaceDeliveryService } from '@/lib/marketplace/delivery/service';
import { myPrograms } from '@/lib/marketplace/delivery/read';
export const dynamic = 'force-dynamic';
export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <DashboardDataBoundary
      load={async () => {
        const actor = await getCurrentStudent(),
          db = getDatabase();
        await new MarketplaceDeliveryService(db).reconcile({
          ownerId: actor.id,
        });
        return (
          <MyPrograms
            programs={await myPrograms(
              db,
              actor.id,
              Number((await searchParams).page || 1),
            )}
            heading
          />
        );
      }}
    />
  );
}
