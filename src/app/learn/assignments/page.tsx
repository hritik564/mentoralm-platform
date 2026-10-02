import { getAcademics, getLmsRepository } from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { AssignmentList } from '@/components/lms/AssignmentList';
export default function Page() {
  return (
    <LmsBoundary
      load={async () => {
        await getLmsRepository();
        const items = await (await getAcademics()).assignments.list();
        return (
          <section className="l3-surface">
            <header className="lms-heading">
              <div>
                <h1>Assignments</h1>
                <p>Course tasks, submissions and reviewer feedback.</p>
              </div>
            </header>
            <AssignmentList items={items} />
          </section>
        );
      }}
    />
  );
}
