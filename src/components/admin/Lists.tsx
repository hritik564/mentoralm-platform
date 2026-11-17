'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { BulkAccess } from './governance/BulkAccess';
import { useAdminData } from './client';
import { State, Pager, Table, AccessPill, DateText, Pill } from './Primitives';
import { useAdminCreateDialog } from './useCreateDialog';
import { BatchEditor } from './editors';
import { adminHref } from '@/lib/platform/domains';
import type { StudentList, BatchList } from './types';
export function AdminLists({ kind }: { kind: 'students' | 'batches' }) {
  const router = useRouter(),
    search = useSearchParams(),
    creation = useAdminCreateDialog(
      'batch',
      '/admin/batches',
      kind === 'batches',
    ),
    [selection, setSelection] = useState<{ query: string; ids: string[] }>({
      query: '',
      ids: [],
    });
  const query = search.toString(),
    { data, error, loading, reload } = useAdminData<StudentList | BatchList>(
      `${kind}?${query}`,
    );
  const selected = selection.query === query ? selection.ids : [];
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(query);
    for (const [k, v] of Object.entries(values))
      if (v) next.set(k, v);
      else next.delete(k);
    router.push(`${adminHref(`/admin/${kind}`)}?${next}`);
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{kind === 'students' ? 'Students' : 'Batches'}</h1>
          <p>
            {kind === 'students'
              ? 'Manage student access, Enrollments and Batch membership.'
              : 'Manage learning cohorts, instructors and Live Sessions.'}
          </p>
        </div>
        {kind === 'batches' && (
          <button className="admin-button" onClick={creation.show}>
            ＋ Create Batch
          </button>
        )}
      </div>
      <div className="admin-card admin-list-card">
        <form
          key={query}
          className="admin-filters"
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            update({
              q: String(fields.get('q') || ''),
              page: '1',
              ...(kind === 'students'
                ? { access: String(fields.get('access') || '') }
                : { status: String(fields.get('status') || '') }),
            });
          }}
        >
          <label className="admin-search-field">
            <span className="sr-only">
              {kind === 'students' ? 'Search students' : 'Search Batches'}
            </span>
            <input
              name="q"
              placeholder={
                kind === 'students'
                  ? 'Search name, email or Student ID…'
                  : 'Search Batch name or code…'
              }
              defaultValue={search.get('q') || ''}
              maxLength={100}
            />
          </label>
          <label>
            <span className="sr-only">
              {kind === 'students' ? 'LMS access' : 'Batch status'}
            </span>
            <select
              name={kind === 'students' ? 'access' : 'status'}
              defaultValue={
                search.get(kind === 'students' ? 'access' : 'status') || ''
              }
            >
              <option value="">
                {kind === 'students' ? 'All LMS access' : 'All statuses'}
              </option>
              {(kind === 'students'
                ? ['enabled', 'disabled']
                : ['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED']
              ).map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <button className="admin-button secondary" type="submit">
            Apply filters
          </button>
          <button
            className="admin-button quiet"
            type="button"
            onClick={() => router.push(adminHref(`/admin/${kind}`))}
          >
            Reset
          </button>
        </form>
        <State {...{ loading, error, reload }} />
        {kind === 'students' && (
          <BulkAccess
            selected={selected}
            clear={() => setSelection({ query, ids: [] })}
            reload={reload}
          />
        )}
        {data &&
          (kind === 'students' ? (
            <Table
              caption="Students"
              headers={[
                'Select',
                'Name',
                'Student ID',
                'Email',
                'Current Batch',
                'LMS access',
                'Account',
                'Joined',
              ]}
            >
              {(data as StudentList).rows.map((s) => (
                <tr key={s.ref}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${s.identity.name}`}
                      checked={selected.includes(s.ref)}
                      onChange={(e) =>
                        setSelection({
                          query,
                          ids: e.target.checked
                            ? [...selected, s.ref].slice(0, 50)
                            : selected.filter((id) => id !== s.ref),
                        })
                      }
                    />
                  </td>
                  <td>
                    <Link
                      className="admin-row-link"
                      href={adminHref(`/admin/students/${s.ref}`)}
                    >
                      {s.identity.name}
                    </Link>
                  </td>
                  <td>{s.studentId || 'Not assigned'}</td>
                  <td>{s.identity.email || '—'}</td>
                  <td>{s.batch}</td>
                  <td>
                    <AccessPill enabled={s.access} />
                  </td>
                  <td>
                    <Pill>{s.identity.status}</Pill>
                  </td>
                  <td>
                    <DateText value={s.joined} />
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Table
              caption="Batches"
              headers={[
                'Batch',
                'Status',
                'Scope',
                'Start',
                'Students',
                'Instructors',
                'LMS access',
              ]}
            >
              {(data as BatchList).rows.map((b) => (
                <tr key={b.ref}>
                  <td>
                    <Link
                      className="admin-row-link"
                      href={adminHref(`/admin/batches/${b.ref}`)}
                    >
                      {b.name}
                    </Link>
                    <small>{b.code}</small>
                  </td>
                  <td>
                    <Pill>{b.status}</Pill>
                  </td>
                  <td>{b.scope}</td>
                  <td>
                    <DateText value={b.starts} />
                  </td>
                  <td>{b.students}</td>
                  <td>{b.instructors}</td>
                  <td>
                    <AccessPill enabled={b.access} />
                  </td>
                </tr>
              ))}
            </Table>
          ))}
        {data && !data.rows.length && (
          <p className="admin-empty">
            No matching {kind}. Adjust your filters or search.
          </p>
        )}
        {data && (
          <Pager
            page={data.page}
            total={data.total}
            onPage={(n) => update({ page: String(n) })}
          />
        )}
      </div>
      {creation.open && (
        <BatchEditor onClose={creation.close} onSaved={reload} />
      )}
    </>
  );
}
