import { getLearningRepository } from '@/lib/lms/services';
import { CoursePlayer } from '@/components/lms/CoursePlayer';
import { LessonDelivery } from '@/components/lms/LessonDelivery';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { StudentError } from '@/lib/student/errors';
import { lmsHref } from '@/lib/platform/domains';
import Link from 'next/link';
export default async function Lesson({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  return (
    <LmsBoundary
      load={async () => {
        const repo = await getLearningRepository(),
          course = await repo.course(courseId);
        try {
          const lesson = await repo.lesson(courseId, lessonId);
          return (
            <CoursePlayer course={course} lesson={lesson}>
              <LessonDelivery lesson={lesson} courseId={courseId} />
            </CoursePlayer>
          );
        } catch (error) {
          if (error instanceof StudentError && error.code === 'NOT_FOUND')
            return (
              <section className="lms-panel">
                <h1>Lesson not available</h1>
                <p>This learning item is not available right now.</p>
                <Link href={lmsHref(`/learn/courses/${courseId}`)}>
                  Return to course
                </Link>
              </section>
            );
          throw error;
        }
      }}
    />
  );
}
