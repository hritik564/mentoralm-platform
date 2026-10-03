'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAdminData, useAdminMutation } from '../client';
import { State, Table, Pager, Pill, AdminDialog } from '../Primitives';
import { adminHref } from '@/lib/platform/domains';
import { adminPermissions } from '@/lib/admin/permissions';
import type { GovernanceRepository } from '@/lib/admin/governance/read';
type Result<K extends 'users' | 'user' | 'audit' | 'settings'> = Awaited<
  ReturnType<GovernanceRepository[K]>
>;
function friendly(value: string) {
  return value.toLowerCase().replaceAll('_', ' ');
}
export function Users({ instructors = false }: { instructors?: boolean }) {
  const search = useSearchParams(),
    router = useRouter(),
    query = search.toString(),
    area = instructors ? 'instructors' : 'users',
    state = useAdminData<Result<'users'>>(`governance/${area}?${query}`);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{instructors ? 'Instructors' : 'Users & Access'}</h1>
          <p>
            {instructors
              ? 'Teaching eligibility and current Batch assignments.'
              : 'Existing platform identities, personas and Admin authority.'}
          </p>
        </div>
      </div>
      {instructors && (
        <p className="admin-card">
          Batch teaching requires the primary INSTRUCTOR persona. An additional
          INSTRUCTOR role is a label and does not make a primary Student
          eligible for assignment.
        </p>
      )}
      <section className="admin-card">
        <form
          className="admin-filters"
          key={query}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              q = new URLSearchParams();
            for (const [k, v] of f) if (v) q.set(k, String(v));
            router.push(`${adminHref(`/admin/${area}`)}?${q}`);
          }}
        >
          <label className="admin-search-field">
            <span className="sr-only">Search users</span>
            <input
              name="q"
              placeholder="Search name, email or Student ID…"
              maxLength={100}
              defaultValue={search.get('q') || ''}
            />
          </label>
          {!instructors && (
            <>
              <label>
                <span className="sr-only">Primary persona</span>
                <select
                  name="persona"
                  defaultValue={search.get('persona') || ''}
                >
                  <option value="">All personas</option>
                  {['STUDENT', 'ADMIN', 'INSTRUCTOR'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Effective role</span>
                <select name="role" defaultValue={search.get('role') || ''}>
                  <option value="">All effective roles</option>
                  {['STUDENT', 'ADMIN', 'INSTRUCTOR'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button className="admin-button secondary">Apply filters</button>
          <button
            type="button"
            className="admin-button quiet"
            onClick={() => router.push(adminHref(`/admin/${area}`))}
          >
            Reset
          </button>
        </form>
        <State {...state} />
        {state.data && (
          <>
            <Table
              caption={instructors ? 'Instructors' : 'Users & Access'}
              headers={[
                'Identity',
                'Primary persona',
                'Additional roles',
                instructors ? 'Teaching' : 'Admin authority',
                'Access summary',
                'Account',
              ]}
            >
              {state.data.rows.map((u) => (
                <tr key={u.ref}>
                  <td>
                    {instructors ? (
                      <strong>{u.name}</strong>
                    ) : (
                      <Link
                        className="admin-row-link"
                        href={adminHref(`/admin/users/${u.ref}`)}
                      >
                        {u.name}
                      </Link>
                    )}
                    <small>{u.email || 'Email unavailable'}</small>
                    <small>{u.studentId || '—'}</small>
                  </td>
                  <td>
                    <Pill>{u.primaryRole}</Pill>
                  </td>
                  <td>{u.additionalRoles.join(', ') || 'None'}</td>
                  <td>
                    {instructors ? (
                      <>
                        {u.teachingEligible ? 'Eligible' : 'Not eligible'}
                        <small>
                          {u.teaching
                            .map((b) => `${b.name} (${b.code})`)
                            .join(', ') || 'No Batch assignments'}
                        </small>
                      </>
                    ) : (
                      u.authority || 'No policy'
                    )}
                  </td>
                  <td>
                    {u.lms}
                    <small>
                      {u.enrollments} Enrollments · {u.memberships} memberships
                    </small>
                  </td>
                  <td>
                    <Pill>{u.status}</Pill>
                  </td>
                </tr>
              ))}
            </Table>
            {!state.data.rows.length && (
              <p className="admin-state">No matching users.</p>
            )}
            <Pager
              page={state.data.page}
              total={state.data.total}
              onPage={(page) => {
                const q = new URLSearchParams(query);
                q.set('page', String(page));
                router.push(`${adminHref(`/admin/${area}`)}?${q}`);
              }}
            />
          </>
        )}
      </section>
    </>
  );
}
export function UserDetail({ refId }: { refId: string }) {
  const state = useAdminData<Result<'user'>>(`governance/users/${refId}`),
    mutation = useAdminMutation(state.reload),
    router = useRouter(),
    [edit, setEdit] = useState<'role' | 'policy' | null>(null),
    u = state.data;
  return (
    <>
      <Link className="admin-text-link" href={adminHref('/admin/users')}>
        ← Users & Access
      </Link>
      <div className="admin-page-heading">
        <div>
          <h1>{u?.identity.name || 'User access'}</h1>
          <p>
            Primary persona stays unchanged. Additional roles and Admin
            permissions are separate.
          </p>
        </div>
      </div>
      <State {...state} />
      {u && (
        <>
          <div className="admin-grid">
            <section className="admin-card">
              <h2>Identity & roles</h2>
              <dl className="admin-key-values">
                <div>
                  <dt>Email</dt>
                  <dd>{u.identity.email || 'Unavailable'}</dd>
                </div>
                <div>
                  <dt>Account</dt>
                  <dd>{u.identity.status}</dd>
                </div>
                <div>
                  <dt>Primary persona</dt>
                  <dd>{u.primaryRole}</dd>
                </div>
                <div>
                  <dt>Additional roles</dt>
                  <dd>{u.additionalRoles.join(', ') || 'None'}</dd>
                </div>
                <div>
                  <dt>Student ID</dt>
                  <dd>{u.studentId || 'Not applicable'}</dd>
                </div>
              </dl>
              <p className="admin-muted">{u.instructorEligibility}</p>
              {u.canManage && (
                <button
                  className="admin-button secondary"
                  onClick={() => setEdit('role')}
                >
                  Manage additional roles
                </button>
              )}
            </section>
            <section className="admin-card">
              <h2>Admin authorization</h2>
              <Pill>
                {u.hasAdmin
                  ? u.policy?.authority || 'No policy'
                  : 'No effective ADMIN'}
              </Pill>
              <p>
                {u.policy?.authority === 'GOVERNANCE'
                  ? 'All Admin capabilities, including governance.'
                  : u.policy?.permissions.length
                    ? u.policy.permissions.map(friendly).join(' · ')
                    : 'No operational permissions assigned.'}
              </p>
              {u.canManage && u.hasAdmin && (
                <button
                  className="admin-button secondary"
                  onClick={() => setEdit('policy')}
                >
                  Manage Admin policy
                </button>
              )}
              {!u.canManage && (
                <p className="admin-muted">
                  Read-only. Governance authority is required to change access.
                </p>
              )}
              {u.isSelf && (
                <p className="admin-muted">
                  Your own final Admin authority and Governance demotion are
                  protected.
                </p>
              )}
            </section>
          </div>
        </>
      )}
      <p role="status">{mutation.notice}</p>
      {edit && u && (
        <AdminDialog
          title={
            edit === 'role'
              ? 'Confirm additional role change'
              : 'Confirm Admin policy change'
          }
          onClose={() => !mutation.busy && setEdit(null)}
        >
          <form
            className="admin-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                body =
                  edit === 'role'
                    ? {
                        role: f.get('role'),
                        operation: f.get('operation'),
                        expectedState: u.state,
                        confirmation: true,
                        reason: f.get('reason'),
                      }
                    : {
                        authority: f.get('authority'),
                        permissions:
                          f.get('authority') === 'GOVERNANCE'
                            ? []
                            : f.getAll('permissions'),
                        expectedRevision: u.policy?.revision || null,
                        confirmation: true,
                        reason: f.get('reason'),
                      };
              const result = await mutation.save(
                `governance/users/${refId}/${edit === 'role' ? 'roles' : 'policy'}`,
                body,
              );
              if (result) {
                setEdit(null);
                router.refresh();
              }
            }}
          >
            {edit === 'role' ? (
              <>
                <label>
                  Additional role
                  <select name="role" required>
                    {['STUDENT', 'ADMIN', 'INSTRUCTOR']
                      .filter((r) => r !== u.primaryRole)
                      .map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                  </select>
                </label>
                <label>
                  Operation
                  <select name="operation">
                    <option value="grant">Grant</option>
                    <option value="revoke">Revoke</option>
                  </select>
                </label>
                <p>
                  A new Admin starts with an empty scoped policy. Regrant does
                  not restore earlier permissions.
                </p>
              </>
            ) : (
              <>
                <label>
                  Authority
                  <select
                    name="authority"
                    defaultValue={u.policy?.authority || 'SCOPED'}
                  >
                    <option>SCOPED</option>
                    {u.policy && <option>GOVERNANCE</option>}
                  </select>
                </label>
                <fieldset>
                  <legend>Scoped permissions</legend>
                  {adminPermissions.map((p) => (
                    <label className="admin-check" key={p}>
                      <input
                        type="checkbox"
                        name="permissions"
                        value={p}
                        defaultChecked={u.policy?.permissions.includes(p)}
                      />
                      {friendly(p)}
                    </label>
                  ))}
                </fieldset>
                <p>
                  Governance includes all capabilities; scoped selections are
                  ignored for Governance.
                </p>
              </>
            )}
            <label>
              Reason
              <textarea name="reason" required minLength={1} maxLength={500} />
            </label>
            <label className="admin-check">
              <input type="checkbox" required />I confirm this access change.
            </label>
            <p role="status">{mutation.notice}</p>
            <div className="admin-form-actions">
              <button className="admin-button" disabled={mutation.busy}>
                {mutation.busy ? 'Saving…' : 'Confirm change'}
              </button>
              <button
                type="button"
                className="admin-button secondary"
                disabled={mutation.busy}
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminDialog>
      )}
    </>
  );
}
export function Audit() {
  const search = useSearchParams(),
    router = useRouter(),
    query = search.toString(),
    state = useAdminData<Result<'audit'>>(`governance/audit?${query}`),
    d = state.data;
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Audit Logs</h1>
          <p>Immutable operational history. Only safe summaries are shown.</p>
        </div>
      </div>
      <section className="admin-card">
        <form
          key={query}
          className="admin-filters"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              q = new URLSearchParams();
            for (const [k, v] of f) if (v) q.set(k, String(v));
            if (search.get('actor')) q.set('actor', search.get('actor')!);
            router.push(`${adminHref('/admin/audit')}?${q}`);
          }}
        >
          {(['category', 'target', 'action'] as const).map((k) => (
            <label key={k}>
              <span className="sr-only">{k}</span>
              <select name={k} defaultValue={search.get(k) || ''}>
                <option value="">
                  All{' '}
                  {k === 'target'
                    ? 'target types'
                    : k === 'category'
                      ? 'categories'
                      : 'operations'}
                </option>
                {(k === 'action'
                  ? d?.filters.actions || []
                  : (k === 'category'
                      ? d?.filters.categories
                      : d?.filters.targets
                    )?.map((v) => ({ value: v, label: v })) || []
                ).map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            From
            <input
              name="from"
              type="date"
              defaultValue={search.get('from') || ''}
            />
          </label>
          <label>
            To
            <input
              name="to"
              type="date"
              defaultValue={search.get('to') || ''}
            />
          </label>
          <button className="admin-button secondary">Apply filters</button>
          <button
            className="admin-button quiet"
            type="button"
            onClick={() => router.push(adminHref('/admin/audit'))}
          >
            Reset
          </button>
        </form>
        {search.get('actor') && (
          <p>Filtered to the selected actor. Reset to view all actors.</p>
        )}
        <State {...state} />
        {d && (
          <>
            <Table
              caption="Audit Logs"
              headers={[
                'When',
                'Actor',
                'Operation',
                'Category / target',
                'Safe summary',
              ]}
            >
              {d.rows.map((r) => (
                <tr key={r.ref}>
                  <td>
                    <time dateTime={r.at}>
                      {new Date(r.at).toLocaleString('en-GB')}
                    </time>
                  </td>
                  <td>
                    <button
                      className="admin-text-link"
                      onClick={() => {
                        const q = new URLSearchParams(query);
                        q.set('actor', r.actorRef);
                        q.delete('page');
                        router.push(`${adminHref('/admin/audit')}?${q}`);
                      }}
                    >
                      {r.actor}
                    </button>
                  </td>
                  <td>{r.action}</td>
                  <td>
                    {r.category}
                    <small>{r.target || 'Historical target unavailable'}</small>
                    {r.targetDescription && (
                      <small>{r.targetDescription}</small>
                    )}
                  </td>
                  <td className="admin-audit-summary">
                    {r.summary.join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </Table>
            {!d.rows.length && (
              <p className="admin-state">No matching audit events.</p>
            )}
            <Pager
              page={d.page}
              total={d.total}
              onPage={(page) => {
                const q = new URLSearchParams(query);
                q.set('page', String(page));
                router.push(`${adminHref('/admin/audit')}?${q}`);
              }}
            />
          </>
        )}
      </section>
    </>
  );
}
export function Settings() {
  const state = useAdminData<Result<'settings'>>('governance/settings');
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Settings</h1>
          <p>
            Read-only readiness. Provider credentials and configuration values
            are never displayed.
          </p>
        </div>
      </div>
      <State {...state} />
      <div className="admin-grid">
        {state.data?.groups.map((g) => (
          <section className="admin-card" key={g.name}>
            <h2>{g.name}</h2>
            <dl className="admin-key-values">
              {g.rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}
