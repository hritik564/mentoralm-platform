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
          <section className="lms-panel l3-surface">
            <h1>Assignments</h1>
            <p>Course tasks, submissions and reviewer feedback.</p>
            <AssignmentList items={items} />
          </section>
        );
      }}
    />
  );
}
