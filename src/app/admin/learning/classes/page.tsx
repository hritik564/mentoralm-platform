import { LearningSessions } from '@/components/admin/Workspaces';
import { WorkspacePage } from '@/components/admin/WorkspacePage';
export default function Page() {
  return (
    <WorkspacePage kind="learning" batchOnly>
      <LearningSessions />
    </WorkspacePage>
  );
}
