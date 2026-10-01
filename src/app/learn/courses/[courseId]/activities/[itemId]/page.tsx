import { getAcademics, getLearningRepository } from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { CoursePlayer } from '@/components/lms/CoursePlayer';
import { AttemptPlayer } from '@/components/lms/AttemptPlayer';
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
          activity = await (
            await getAcademics()
          ).attempts.view(courseId, itemId);
        return (
          <CoursePlayer
            course={course}
            lesson={null}
            activity={{ id: itemId, title: activity.title }}
          >
            <AttemptPlayer courseId={courseId} activity={activity} />
          </CoursePlayer>
        );
      }}
    />
  );
}
