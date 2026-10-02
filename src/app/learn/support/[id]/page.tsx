import Link from 'next/link';
import { getTicket } from '@/lib/student/services';
import { getLmsRepository } from '@/lib/lms/services';
import { lmsHref } from '@/lib/platform/domains';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { LmsTicketConversation } from '@/components/lms/LmsSupport';
export const metadata = { title: 'Support ticket | MentoraLM Learning' };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <LmsBoundary
      load={async () => {
        await getLmsRepository();
        const ticket = await getTicket(id);
        return (
          <>
            <Link className="lms-back" href={lmsHref('/learn/support')}>
              ← All support tickets
            </Link>
            <LmsTicketConversation ticket={ticket} />
          </>
        );
      }}
    />
  );
}
