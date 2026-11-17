import { AdminWorkspace } from '@/components/admin/Workspaces';
import { WorkspacePage } from '@/components/admin/WorkspacePage';
export default function Page() {
  return (
    <WorkspacePage kind="people">
      <AdminWorkspace kind="people" />
    </WorkspacePage>
  );
}
