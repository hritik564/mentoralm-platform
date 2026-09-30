import { requireStudentIdentity } from '@/lib/auth/session';
import { getDashboardCourses } from '@/lib/dashboard/courses';
import '@/styles/dashboard-courses.css';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
export default async function OverviewPage() {
  return (
    <DashboardOverview
      user={await requireStudentIdentity()}
      courses={getDashboardCourses()}
    />
  );
}
