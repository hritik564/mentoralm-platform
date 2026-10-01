import { getAcademics, getLearningRepository } from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { CoursePlayer } from '@/components/lms/CoursePlayer';
import { AssignmentDetail } from '@/components/lms/AssignmentDetail';
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string; itemId: string }>;
}) {
  const { courseId, itemId } = await params;
  return (
    <LmsBoundary
      load={async () => {
        const course = await (await getLearningRepository()).course(courseId),
          assignment = await (
            await getAcademics()
          ).assignments.view(courseId, itemId);
        return (
          <CoursePlayer
            course={course}
            lesson={null}
            activity={{ id: itemId, title: assignment.title }}
          >
            <AssignmentDetail courseId={courseId} assignment={assignment} />
          </CoursePlayer>
        );
      }}
    />
  );
}
