import { getCourseStructure } from '@/lib/lms/services';
import { CourseStructure } from '@/components/lms/LmsViews';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
export default async function Course({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return (
    <LmsBoundary
      load={async () => (
        <CourseStructure course={await getCourseStructure(courseId)} />
      )}
    />
  );
}
