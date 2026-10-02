import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { getLearningRepository } from '@/lib/lms/services';
import { LectureList } from '@/components/lms/LectureList';
import { LmsPageHeader } from '@/components/lms/LmsPrimitives';
export default function Lectures() {
  return (
    <LmsBoundary
      load={async () => (
        <>
          <LmsPageHeader
            title="Lectures"
            description="Lessons and learning activities in your enrolled courses."
          />
          <LectureList
            courses={await (await getLearningRepository()).courses()}
          />
        </>
      )}
    />
  );
}
