import { DiscussionWorkspace } from '@/components/lms/Discussions';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { getDiscussions } from '@/lib/lms/services';
export default function Page() {
  return (
    <LmsBoundary
      load={async () => (
        <DiscussionWorkspace
          workspace={await (await getDiscussions()).workspace()}
        />
      )}
    />
  );
}
