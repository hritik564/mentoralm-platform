'use client';
import Link from 'next/link';
import { useState } from 'react';
import { adminHref } from '@/lib/platform/domains';
import { useAdminData, useAdminMutation } from '../client';
import { AdminDialog, Table, Pager, Pill, State } from '../Primitives';
import { Field, FormActions } from './forms';
import type { Bank } from './types';
export function QuestionBank({ bankRef }: { bankRef: string }) {
  const [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [editor, setEditor] = useState<Bank['rows'][number] | 'new' | null>(null),
    bank = useAdminData<Bank>(
      `academic/banks/${bankRef}?${new URLSearchParams({ page: String(page), q })}`,
    );
  return (
    <>
      <Link className="admin-back" href={adminHref('/admin/assessments')}>
        ← Assessments &amp; Question Banks
      </Link>
      <div className="admin-page-heading">
        <div>
          <span className="academic-eyebrow">Question Bank</span>
          <h1>{bank.data?.title || 'Questions'}</h1>
          <p>
            Reusable academic questions; private answer configuration is
            Admin-only.
          </p>
        </div>
        <button className="admin-button" onClick={() => setEditor('new')}>
          Add question
        </button>
      </div>
      <div className="academic-toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQ(String(new FormData(e.currentTarget).get('q') || ''));
            setPage(1);
          }}
        >
          <Field label="Search question prompt">
            <input name="q" maxLength={100} />
          </Field>
          <button className="admin-button secondary">Search</button>
        </form>
      </div>
      <State {...bank} />
      {bank.data && (
        <section className="admin-card academic-table">
          <Table
            caption="Questions in bank"
            headers={['Question', 'Type', 'Status', 'Activity uses', 'Actions']}
          >
            {bank.data.rows.map((r) => (
              <tr key={r.ref}>
                <td>{r.prompt}</td>
                <td>{r.type}</td>
                <td>
                  <Pill>{r.published ? 'PUBLISHED' : 'DRAFT'}</Pill>
                </td>
                <td>{r.uses}</td>
                <td>
                  <button
                    className="admin-button secondary"
                    onClick={() => setEditor(r)}
                  >
                    Edit question
                  </button>
                </td>
              </tr>
            ))}
          </Table>
          {!bank.data.rows.length && (
            <p className="admin-empty">No questions in this bank.</p>
          )}
          <Pager page={page} total={bank.data.total} onPage={setPage} />
        </section>
      )}
      {editor && (
        <QuestionEditor
          bankRef={bankRef}
          initial={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={bank.reload}
        />
      )}
    </>
  );
}
function QuestionEditor({
  bankRef,
  initial,
  onClose,
  onSaved,
}: {
  bankRef: string;
  initial?: Bank['rows'][number];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState(initial?.type || 'SINGLE_CHOICE'),
    [options, setOptions] = useState(
      initial?.options || [
        { label: '', correct: true },
        { label: '', correct: false },
      ],
    ),
    mutation = useAdminMutation(onSaved),
    choice = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(type);
  function changeType(value: typeof type) {
    setType(value);
    setOptions(
      value === 'TRUE_FALSE'
        ? [
            { label: 'True', correct: true },
            { label: 'False', correct: false },
          ]
        : ['SHORT_TEXT', 'LONG_TEXT'].includes(value)
          ? []
          : [
              { label: '', correct: true },
              { label: '', correct: false },
            ],
    );
  }
  return (
    <AdminDialog
      title={initial ? 'Edit question' : 'Add question'}
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const r = await mutation.save(
            `academic/banks/${bankRef}/questions${initial ? `/${initial.ref}` : ''}`,
            {
              type,
              prompt: f.get('prompt'),
              explanation: f.get('explanation') || null,
              published: f.has('published'),
              options: choice ? options : [],
            },
          );
          if (r) onClose();
        }}
      >
        <Field label="Question type">
          <select
            value={type}
            disabled={!!initial}
            onChange={(e) => changeType(e.target.value as typeof type)}
          >
            {[
              'SINGLE_CHOICE',
              'MULTIPLE_CHOICE',
              'TRUE_FALSE',
              'SHORT_TEXT',
              'LONG_TEXT',
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Question prompt">
          <textarea
            name="prompt"
            required
            maxLength={12000}
            defaultValue={initial?.prompt || ''}
          />
        </Field>
        <Field label="Explanation (optional)">
          <textarea
            name="explanation"
            maxLength={4000}
            defaultValue={initial?.explanation || ''}
          />
        </Field>
        {choice ? (
          <fieldset>
            <legend>
              {type === 'MULTIPLE_CHOICE'
                ? 'Options — one or more correct'
                : 'Options — exactly one correct'}
            </legend>
            {options.map((o, n) => (
              <div className="academic-option" key={n}>
                <Field label={`Option ${n + 1}`}>
                  <input
                    required
                    maxLength={2000}
                    value={o.label}
                    readOnly={type === 'TRUE_FALSE'}
                    onChange={(e) =>
                      setOptions((old) =>
                        old.map((v, i) =>
                          i === n ? { ...v, label: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                <label className="academic-check">
                  <input
                    type="checkbox"
                    checked={o.correct}
                    onChange={(e) =>
                      setOptions((old) =>
                        old.map((v, i) =>
                          i === n
                            ? { ...v, correct: e.target.checked }
                            : type === 'MULTIPLE_CHOICE'
                              ? v
                              : { ...v, correct: false },
                        ),
                      )
                    }
                  />{' '}
                  Correct option {n + 1}
                </label>
                {type !== 'TRUE_FALSE' && (
                  <button
                    type="button"
                    className="admin-button secondary"
                    disabled={options.length <= 2}
                    onClick={() =>
                      setOptions((old) => old.filter((_, i) => i !== n))
                    }
                  >
                    Remove option {n + 1}
                  </button>
                )}
              </div>
            ))}
            {type !== 'TRUE_FALSE' && (
              <button
                type="button"
                className="admin-button secondary"
                disabled={options.length >= 30}
                onClick={() =>
                  setOptions((old) => [...old, { label: '', correct: false }])
                }
              >
                Add option
              </button>
            )}
          </fieldset>
        ) : (
          <p className="admin-muted">
            Text responses require staff review. No correct-answer key or
            automatic semantic grading is configured.
          </p>
        )}
        <label className="academic-check">
          <input
            type="checkbox"
            name="published"
            defaultChecked={initial?.published || false}
          />{' '}
          Published question
        </label>
        <p className="admin-muted">
          A question used by a published activity cannot be unpublished until
          that activity is unpublished. Existing attempt snapshots are preserved
          when answers change.
        </p>
        <FormActions busy={mutation.busy} notice={mutation.notice} />
      </form>
    </AdminDialog>
  );
}
