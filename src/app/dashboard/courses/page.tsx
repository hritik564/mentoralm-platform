import { MyCourses } from '@/components/dashboard/courses/MyCourses';
import { getStudentCourses } from '@/lib/student/services';
import { requireStudentIdentity } from '@/lib/auth/session';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';
import '@/styles/dashboard-courses.css';
export const metadata = { title: 'My Courses' };
export default async function Page() {
  await requireStudentIdentity();
  return (
    <DashboardDataBoundary
      load={async () => <MyCourses courses={await getStudentCourses()} />}
    />
  );
}
