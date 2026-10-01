// Browser-only component fixtures; this file is never part of the app routes.
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { ProfileEditor } from '../../src/components/dashboard/profile/ProfileEditor';
import { createRoot } from 'react-dom/client';
import { ResourceLibrary } from '../../src/components/dashboard/resources/ResourceLibrary';
import { SupportPage } from '../../src/components/dashboard/support/SupportPage';
import { ReferralPage } from '../../src/components/dashboard/referral/ReferralPage';
import type {
  Resource,
  ResourceRegistry,
} from '../../src/lib/dashboard/resources';
import type { SupportTicket } from '../../src/lib/dashboard/support';
import type {
  ReferralSummary,
  ReferralRegistry,
} from '../../src/lib/dashboard/referral';
const router = {
  bfcacheId: 'fixture',
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};
type Fixture =
  | { surface: 'profile' }
  | { surface: 'resources'; resources: Resource[]; registry: ResourceRegistry }
  | { surface: 'support'; tickets: SupportTicket[] }
  | {
      surface: 'referral';
      summary: ReferralSummary;
      registry: ReferralRegistry;
    };
const element = document.getElementById('fixture-root')!;
const fixture = JSON.parse(element.dataset.fixture!) as Fixture;
createRoot(element).render(
  <AppRouterContext.Provider value={router}>
    <div
      className="dashboard-shell"
      data-dashboard-theme={element.dataset.theme || 'light'}
      style={{ display: 'block', padding: 24 }}
    >
      <main id="dashboard-content">
        {fixture.surface === 'profile' ? (
          <ProfileEditor
            education={null}
            onClose={() => {}}
            onSaved={() => {
              document.documentElement.dataset.saved = 'true';
            }}
          />
        ) : fixture.surface === 'resources' ? (
          <ResourceLibrary
            resources={fixture.resources}
            registry={fixture.registry}
          />
        ) : fixture.surface === 'support' ? (
          <SupportPage tickets={fixture.tickets} />
        ) : (
          <ReferralPage summary={fixture.summary} registry={fixture.registry} />
        )}
      </main>
    </div>
  </AppRouterContext.Provider>,
);
