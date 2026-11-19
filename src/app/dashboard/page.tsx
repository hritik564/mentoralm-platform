import { MyPrograms } from '@/components/marketplace/delivery/MyPrograms';
import { myPrograms } from '@/lib/marketplace/delivery/read';
import { MarketplaceDeliveryService } from '@/lib/marketplace/delivery/service';
import { getCurrentStudent } from '@/lib/student/session';
import { getDatabase } from '@/lib/db/client';
import { requireStudentIdentity } from '@/lib/auth/session';
import { getStudentCourses, getResources } from '@/lib/student/services';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';
import '@/styles/dashboard-courses.css';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
export default async function OverviewPage() {
  const user = await requireStudentIdentity();
  return (
    <>
      <DashboardDataBoundary
        load={async () => {
          const actor = await getCurrentStudent();
          if (actor.role !== 'STUDENT')
            return (
              <p>
                Your purchased programs are available below. Learning access
                requires a Student identity.
              </p>
            );
          const [courses, resources] = await Promise.all([
            getStudentCourses(),
            getResources(),
          ]);
          return (
            <DashboardOverview
              user={user}
              courses={courses}
              resourcesAvailable={resources.resources.length > 0}
            />
          );
        }}
      />
      <DashboardDataBoundary
        load={async () => {
          const actor = await getCurrentStudent(),
            db = getDatabase();
          await new MarketplaceDeliveryService(db).reconcile({
            ownerId: actor.id,
          });
          return <MyPrograms programs={await myPrograms(db, actor.id)} />;
        }}
      />
    </>
  );
}
