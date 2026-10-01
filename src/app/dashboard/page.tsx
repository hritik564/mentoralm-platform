import { requireStudentIdentity } from '@/lib/auth/session';
import { getStudentCourses, getResources } from '@/lib/student/services';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';
import '@/styles/dashboard-courses.css';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
export default async function OverviewPage() {
  const user = await requireStudentIdentity();
  return (
    <DashboardDataBoundary
      load={async () => {
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
  );
}
