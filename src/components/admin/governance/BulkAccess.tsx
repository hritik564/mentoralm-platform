'use client';
import { useState } from 'react';
import { AdminDialog } from '../Primitives';
import { adminRequest } from '../client';
export function BulkAccess({
  selected,
  clear,
  reload,
}: {
  selected: string[];
  clear: () => void;
  reload: () => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  return (
    <>
      <div className="admin-form-actions">
        <span>{selected.length} explicitly selected (maximum 50)</span>
        <button
          className="admin-button secondary"
          disabled={!selected.length}
          onClick={() => setOpen(true)}
        >
          Change selected LMS access
        </button>
        <button
          className="admin-button quiet"
          disabled={!selected.length}
          onClick={clear}
        >
          Clear selection
        </button>
      </div>
      <p role="status">{notice}</p>
      {open && (
        <AdminDialog
          title="Confirm selected LMS access"
          onClose={() => !busy && setOpen(false)}
        >
          <form
            className="admin-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                const d = await adminRequest<{
                  results: { saved: boolean; error: string | null }[];
                }>('governance/bulk/lms-access', {
                  users: selected,
                  value: f.get('value'),
                  confirmation: true,
                  reason: f.get('reason'),
                });
                setNotice(
                  `${d.results.filter((r) => r.saved).length} saved; ${d.results.filter((r) => !r.saved).length} failed. ${d.results
                    .map((r, i) =>
                      r.saved ? '' : `Selection ${i + 1}: ${r.error}`,
                    )
                    .filter(Boolean)
                    .join(' ')}`,
                );
                setOpen(false);
                clear();
                reload();
              } catch (err) {
                setNotice(
                  err instanceof Error ? err.message : 'Unable to save.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              Apply to {selected.length} selected Students. Each target is
              checked and audited separately. Other Students are unaffected.
            </p>
            <label>
              LMS override
              <select name="value">
                <option value="INHERIT">Inherit Batch access</option>
                <option value="ENABLED">Enabled</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </label>
            <label>
              Reason
              <textarea name="reason" maxLength={500} required />
            </label>
            <label className="admin-check">
              <input type="checkbox" required />I confirm this change for the
              selected Students.
            </label>
            <p role="status">{notice}</p>
            <button className="admin-button" disabled={busy}>
              {busy ? 'Saving…' : 'Confirm selected change'}
            </button>
          </form>
        </AdminDialog>
      )}
    </>
  );
}
