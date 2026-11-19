import { EnrollmentShell } from '@/components/marketplace/enrollment/EnrollmentShell';
import { EnrollmentFlow } from '@/components/marketplace/enrollment/EnrollmentFlow';
import { enrollmentPage } from '@/lib/marketplace/enrollment/page';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Your enrollment',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default async function EnrollPage({
  params,
}: {
  params: Promise<{ intentRef: string }>;
}) {
  const { intentRef } = await params;
  const data = await enrollmentPage(intentRef);
  return (
    <EnrollmentShell>
      <EnrollmentFlow {...data} />
    </EnrollmentShell>
  );
}
