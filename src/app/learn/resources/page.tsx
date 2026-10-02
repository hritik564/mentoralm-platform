import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { getLearningRepository } from '@/lib/lms/services';
import { LearningResources } from '@/components/lms/LearningLists';
export default function Resources() {
  return (
    <LmsBoundary
      load={async () => (
        <>
          <h1>Learning resources</h1>
          <p className="lms-intro">
            Materials from your enrolled courses. Your general resource library
            remains in Dashboard.
          </p>
          <section>
            <LearningResources
              resources={await (await getLearningRepository()).resources()}
            />
          </section>
        </>
      )}
    />
  );
}
