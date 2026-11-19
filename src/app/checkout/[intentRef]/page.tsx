import { EnrollmentShell } from '@/components/marketplace/enrollment/EnrollmentShell';
import { CheckoutSummary } from '@/components/marketplace/enrollment/CheckoutSummary';
import { enrollmentPage } from '@/lib/marketplace/enrollment/page';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Enrollment summary',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ intentRef: string }>;
}) {
  const { intentRef } = await params;
  const data = await enrollmentPage(intentRef, true);
  return (
    <EnrollmentShell>
      <CheckoutSummary {...data} />
    </EnrollmentShell>
  );
}
