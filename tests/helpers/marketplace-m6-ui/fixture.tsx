// Test-only native component harness. Never imported by app routes.
import { createRoot } from 'react-dom/client';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PaymentAction } from '../../../src/components/marketplace/commerce/PaymentAction';
import type { EnrollmentView } from '../../../src/lib/marketplace/enrollment/types';
import type { PurchasePolicy } from '../../../src/lib/marketplace/commerce/orders';
const element = document.getElementById('m6-root')!;
const fixture = JSON.parse(
  document.getElementById('m6-data')!.textContent!,
) as { view: EnrollmentView; policy: PurchasePolicy; availability: string };
const router = {
  bfcacheId: 'm6-fixture',
  back: () => history.back(),
  forward: () => history.forward(),
  refresh: () => location.reload(),
  push: (href: string) => location.assign(href),
  replace: (href: string) => location.replace(href),
  prefetch: async () => {},
};
createRoot(element).render(
  <AppRouterContext.Provider value={router}>
    <div className="enrollment-shell">
      <main className="enrollment-main">
        <section className="enrollment-card">
          <h1>Secure payment</h1>
          <p>{fixture.view.quote.title}</p>
          <PaymentAction {...fixture} />
        </section>
      </main>
    </div>
  </AppRouterContext.Provider>,
);
