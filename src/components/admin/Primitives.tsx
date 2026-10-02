'use client';
import { useState } from 'react';
import { DashboardDialog } from '../dashboard/DashboardDialog';
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  return <span className={`admin-pill ${tone}`}>{children}</span>;
}
export function AccessPill({ enabled }: { enabled: boolean }) {
  return (
    <Pill tone={enabled ? 'good' : 'bad'}>
      {enabled ? 'Enabled' : 'Disabled'}
    </Pill>
  );
}
export function DateText({ value }: { value: string | null }) {
  return (
    <>
      {value
        ? new Date(value).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '—'}
    </>
  );
}
export function State({
  loading,
  error,
  reload,
}: {
  loading: boolean;
  error?: string;
  reload: () => void;
}) {
  return loading ? (
    <p className="admin-state" role="status">
      Loading workspace…
    </p>
  ) : error ? (
    <div className="admin-state">
      <p role="alert">{error}</p>
      <button className="admin-button secondary" onClick={reload}>
        Try again
      </button>
    </div>
  ) : null;
}
export function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <div className="admin-pagination">
      <span>
        {total
          ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total}`
          : 'No results'}
      </span>
      <nav aria-label="Pagination">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </nav>
    </div>
  );
}
export function Tabs({
  labels,
  children,
}: {
  labels: string[];
  children: (active: string) => React.ReactNode;
}) {
  const [active, setActive] = useState(labels[0]);
  return (
    <>
      <div className="admin-tabs" role="group" aria-label="Detail sections">
        {labels.map((label) => (
          <button
            key={label}
            aria-pressed={active === label}
            onClick={() => setActive(label)}
          >
            {label}
          </button>
        ))}
      </div>
      {children(active)}
    </>
  );
}
export function AdminDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <DashboardDialog title={title} onClose={onClose} className="admin-dialog">
      {children}
    </DashboardDialog>
  );
}
export function Table({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div
      className="admin-table-scroll"
      tabIndex={0}
      aria-label={`${caption} table, scroll horizontally if needed`}
    >
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
