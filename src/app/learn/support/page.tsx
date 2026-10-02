import { getTickets } from '@/lib/student/services';
import { getLmsRepository } from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { LmsSupport } from '@/components/lms/LmsSupport';
export const metadata = { title: 'Support | MentoraLM Learning' };
export default function Page() {
  return (
    <LmsBoundary
      load={async () => {
        await getLmsRepository();
        return <LmsSupport tickets={await getTickets()} />;
      }}
    />
  );
}
