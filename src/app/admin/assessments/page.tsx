import Link from 'next/link';
import { adminHref } from '@/lib/platform/domains';
import { AcademicActivities } from '@/components/admin/academic/Catalog';
export default function Page() {
  return (
    <>
      <Link
        className="admin-button secondary"
        href={adminHref('/admin/attempts')}
      >
        Text-response reviews →
      </Link>
      <AcademicActivities />
    </>
  );
}
