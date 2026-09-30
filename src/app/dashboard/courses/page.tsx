import { MyCourses } from '@/components/dashboard/courses/MyCourses';
import { getDashboardCourses } from '@/lib/dashboard/courses';
import { requireStudentIdentity } from '@/lib/auth/session';
import '@/styles/dashboard-courses.css';
export const metadata = { title: 'My Courses' };
export default async function Page() {
  await requireStudentIdentity();
  return <MyCourses courses={getDashboardCourses()} />;
}
