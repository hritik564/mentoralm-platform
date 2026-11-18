// Browser-only adapters and synthetic data are never imported by application routes.
import { createRoot } from 'react-dom/client';
import { AdminShell } from '@/components/admin/AdminShell';
import { MarketplaceEditor } from '@/components/admin/marketplace/MarketplaceEditor';
import { AdminDashboard } from '@/components/admin/Dashboard';
import {
  AdminWorkspace,
  LearningSessions,
} from '@/components/admin/Workspaces';
import { AdminLists } from '@/components/admin/Lists';
import { AdminBatchDetail } from '@/components/admin/BatchDetail';
import { Settings, Users, Audit } from '@/components/admin/governance/Views';
import { CourseBuilder } from '@/components/admin/academic/Builder';
import { OperationalList } from '@/components/admin/operational/List';
import { AcademicWorkspace } from '@/components/admin/academic/Catalog';
import { DashboardTheme } from '@/components/dashboard/theme/DashboardTheme';
import type { AccountIdentity } from '@/components/auth/UserAvatar';
import type {
  AdminAuthority,
  AdminPermission,
} from '@/generated/prisma/client';
import { FixtureRouter, usePathname } from './runtime';

type Fixture = {
  theme: 'light' | 'dark';
  access: { authority: AdminAuthority | null; permissions: AdminPermission[] };
};
const element = document.getElementById('fixture-root')!;
const fixture = JSON.parse(element.dataset.fixture!) as Fixture;
const account: AccountIdentity = {
  name: 'Morgan Test',
  firstName: 'Morgan',
  email: 'morgan@example.test',
  imageUrl: null,
};

function Surface() {
  const path = usePathname();
  if (path === '/admin') return <AdminDashboard />;
  if (path === '/admin/marketplace/new') return <MarketplaceEditor />;
  if (path === '/admin/learning') return <AdminWorkspace kind="learning" />;
  if (path === '/admin/people') return <AdminWorkspace kind="people" />;
  if (path === '/admin/inbox') return <AdminWorkspace kind="inbox" />;
  if (path === '/admin/learning/classes') return <LearningSessions />;
  if (path === '/admin/learning/recordings')
    return <LearningSessions recordings />;
  if (path === '/admin/students') return <AdminLists kind="students" />;
  if (path === '/admin/batches') return <AdminLists kind="batches" />;
  if (path === '/admin/batches/fixture_batch_1')
    return <AdminBatchDetail refId="fixture_batch_1" />;
  if (path === '/admin/settings') return <Settings />;
  if (path === '/admin/users') return <Users />;
  if (path === '/admin/instructors') return <Users instructors />;
  if (path === '/admin/audit') return <Audit />;
  if (path === '/admin/courses') return <AcademicWorkspace />;
  if (path === '/admin/courses/fixture_course_1')
    return <CourseBuilder courseRef="fixture_course_1" />;
  if (path === '/admin/attendance')
    return <OperationalList area="attendance" />;
  if (path === '/admin/submissions')
    return <OperationalList area="submissions" />;
  if (path === '/admin/attempts') return <OperationalList area="attempts" />;
  if (path === '/admin/certificates')
    return <OperationalList area="certificates" />;
  // Legacy-route group tests exercise the real shell/navigation without
  // pretending to validate unrelated detail implementations or server access.
  return (
    <section className="admin-card">
      <h1>Existing Admin destination</h1>
      <p>Route grouping fixture: {path}</p>
    </section>
  );
}

createRoot(element).render(
  <DashboardTheme initialTheme={fixture.theme}>
    <FixtureRouter>
      <AdminShell user={account} access={fixture.access}>
        <Surface />
      </AdminShell>
    </FixtureRouter>
  </DashboardTheme>,
);
