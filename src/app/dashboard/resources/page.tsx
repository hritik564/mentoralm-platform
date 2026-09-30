import { ResourceLibrary } from '@/components/dashboard/resources/ResourceLibrary';
import { getStudentResources } from '@/lib/dashboard/resources';
import { requireStudentIdentity } from '@/lib/auth/session';
export const metadata = { title: 'Resources' };
export default async function Page() {
  await requireStudentIdentity();
  return <ResourceLibrary resources={getStudentResources()} />;
}
