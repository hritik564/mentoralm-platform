import { getLearningRepository } from '@/lib/lms/services';
import { CoursePlayer } from '@/components/lms/CoursePlayer';
import { LearningResources } from '@/components/lms/LearningLists';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
export default async function Course({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return (
    <LmsBoundary
      load={async () => {
        const repo = await getLearningRepository();
        const [course, resources] = await Promise.all([
          repo.course(courseId),
          repo.resources(courseId),
        ]);
        return (
          <CoursePlayer course={course} lesson={null}>
            <section className="l2-course-resources">
              <h3>Course resources</h3>
              <LearningResources resources={resources} />
            </section>
          </CoursePlayer>
        );
      }}
    />
  );
}
