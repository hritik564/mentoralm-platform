'use client';
import Link from 'next/link';
import { State } from '../Primitives';
import { adminHref } from '@/lib/platform/domains';
export function OperationalFrame({
  area,
  title,
  children,
  data,
}: {
  area: string;
  title: string;
  children: React.ReactNode;
  data: { loading: boolean; error?: string; reload: () => void };
}) {
  return (
    <>
      <Link className="admin-back" href={adminHref(`/admin/${area}`)}>
        ← Back to {area}
      </Link>
      <div className="admin-page-heading">
        <h1>{title}</h1>
      </div>
      <State {...data} />
      {children}
    </>
  );
}
export function RecordText({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}
