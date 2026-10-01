import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { getLearningRepository } from '@/lib/lms/services';
import { LearningResources } from '@/components/lms/LearningLists';
export default function Resources() {
  return (
    <LmsBoundary
      load={async () => (
        <>
          <p className="lms-eyebrow">Learn</p>
          <h1>Learning resources</h1>
          <p className="lms-intro">
            Materials from your enrolled courses. Your general resource library
            remains in Dashboard.
          </p>
          <section className="lms-panel">
            <LearningResources
              resources={await (await getLearningRepository()).resources()}
            />
          </section>
        </>
      )}
    />
  );
}
