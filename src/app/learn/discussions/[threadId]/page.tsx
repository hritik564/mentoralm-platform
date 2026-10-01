import { DiscussionConversation } from '@/components/lms/Discussions';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { getDiscussions } from '@/lib/lms/services';
import { StudentError } from '@/lib/student/errors';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { threadId } = await params,
    query = await searchParams;
  return (
    <LmsBoundary
      load={async () => {
        if (
          Object.keys(query).some((k) => k !== 'before') ||
          typeof query.before === 'object'
        )
          throw new StudentError('INVALID_INPUT');
        return (
          <DiscussionConversation
            thread={await (
              await getDiscussions()
            ).thread(threadId, query.before)}
          />
        );
      }}
    />
  );
}
