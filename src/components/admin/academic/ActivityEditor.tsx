'use client';
import { useState } from 'react';
import { useAdminData, useAdminMutation } from '../client';
import { Field, FormActions } from './forms';
import { State } from '../Primitives';
import type { ItemDetail, Banks, Bank } from './types';
export function ActivityEditor({
  item,
  path,
  onSaved,
}: {
  item: ItemDetail;
  path: string;
  onSaved: () => void;
}) {
  const a = item.activity,
    mutation = useAdminMutation(onSaved),
    [bank, setBank] = useState(''),
    [bankQuery, setBankQuery] = useState(''),
    [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [selected, setSelected] = useState(a?.questions || []);
  const banks = useAdminData<Banks>(
      `academic/banks?q=${encodeURIComponent(bankQuery)}`,
    ),
    questions = useAdminData<Bank>(
      bank
        ? `academic/banks/${bank}?${new URLSearchParams({ page: String(page), q })}`
        : null,
    );
  return (
    <section className="academic-editor-panel">
      <h3>{item.type === 'QUIZ' ? 'Quiz' : 'Assessment'} configuration</h3>
      <p className="admin-muted">
        Objective answers use the existing exact-match scoring. Text requires
        review.{' '}
        {item.type === 'ASSESSMENT'
          ? 'Academic assessment only; no interpretation or AI grading.'
          : ''}{' '}
        Existing attempts retain immutable question/answer snapshots.
      </p>
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await mutation.save(`${path}/activity`, {
            instructions: f.get('instructions'),
            passingPercent:
              f.get('passing') !== '' ? Number(f.get('passing')) : null,
            attemptLimit: f.get('limit') !== '' ? Number(f.get('limit')) : null,
            reviewAnswers: f.has('review'),
            questions: selected.map((q) => ({
              questionId: q.questionRef,
              points: q.points,
            })),
          });
        }}
      >
        <Field label="Activity instructions">
          <textarea
            name="instructions"
            required
            maxLength={12000}
            defaultValue={a?.instructions || ''}
          />
        </Field>
        <div className="academic-form-grid">
          <Field label="Passing percentage (optional)">
            <input
              name="passing"
              type="number"
              min={0}
              max={100}
              step="any"
              defaultValue={a?.passingPercent ?? ''}
            />
          </Field>
          <Field label="Attempt limit (optional)">
            <input
              name="limit"
              type="number"
              min={1}
              max={100}
              defaultValue={a?.attemptLimit ?? ''}
            />
          </Field>
        </div>
        <label className="academic-check">
          <input
            type="checkbox"
            name="review"
            defaultChecked={a?.reviewAnswers || false}
          />{' '}
          Reveal answers after submission
        </label>
        <fieldset>
          <legend>
            Selected questions in delivery order ({selected.length})
          </legend>
          {selected.map((v, n) => (
            <div className="academic-selected-question" key={v.questionRef}>
              <span>
                {n + 1}. {v.prompt}
              </span>
              <Field label={`Points for question ${n + 1}`}>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  required
                  value={v.points}
                  onChange={(e) =>
                    setSelected((old) =>
                      old.map((s, i) =>
                        i === n ? { ...s, points: Number(e.target.value) } : s,
                      ),
                    )
                  }
                />
              </Field>
              <button
                className="admin-button secondary"
                type="button"
                disabled={n === 0}
                aria-label={`Move selected question ${n + 1} up`}
                onClick={() =>
                  setSelected((old) => {
                    const v = [...old];
                    [v[n - 1], v[n]] = [v[n], v[n - 1]];
                    return v;
                  })
                }
              >
                ↑
              </button>
              <button
                type="button"
                className="admin-button secondary"
                onClick={() =>
                  setSelected((old) =>
                    old.filter((s) => s.questionRef !== v.questionRef),
                  )
                }
              >
                Remove question
              </button>
            </div>
          ))}
          {!selected.length && <p>Select at least one question below.</p>}
        </fieldset>
        <Field label="Find Question Bank">
          <input
            value={bankQuery}
            maxLength={100}
            onChange={(e) => setBankQuery(e.target.value)}
            placeholder="Search bank title"
          />
        </Field>
        <Field label="Question Bank">
          <select
            value={bank}
            onChange={(e) => {
              setBank(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Choose bank</option>
            {banks.data?.rows.map((b) => (
              <option key={b.ref} value={b.ref}>
                {b.title}
              </option>
            ))}
          </select>
        </Field>
        <p className="admin-muted">
          Up to 20 matching banks are listed. Narrow the search to find another
          bank.
        </p>
        {bank && (
          <>
            <Field label="Filter question prompt">
              <input
                value={q}
                maxLength={100}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </Field>
            <State {...questions} />
            <div className="academic-question-picker">
              {questions.data?.rows.map((v) => (
                <button
                  className="academic-choice"
                  type="button"
                  key={v.ref}
                  disabled={
                    selected.some((s) => s.questionRef === v.ref) ||
                    selected.length >= 100
                  }
                  onClick={() =>
                    setSelected((old) => [
                      ...old,
                      {
                        questionRef: v.ref,
                        prompt: v.prompt,
                        type: v.type,
                        points: 1,
                      },
                    ])
                  }
                >
                  <span>{v.prompt}</span>
                  <small>
                    {v.type} · {v.published ? 'PUBLISHED' : 'DRAFT'} · Add
                  </small>
                </button>
              ))}
            </div>
            <div className="academic-actions">
              <button
                type="button"
                className="admin-button secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous questions
              </button>
              <span>Page {page}</span>
              <button
                type="button"
                className="admin-button secondary"
                disabled={!questions.data || page * 20 >= questions.data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next questions
              </button>
            </div>
          </>
        )}
        <FormActions busy={mutation.busy} notice={mutation.notice} />
      </form>
    </section>
  );
}
export function AssignmentEditor({
  item,
  path,
  onSaved,
}: {
  item: ItemDetail;
  path: string;
  onSaved: () => void;
}) {
  const a = item.assignment,
    mutation = useAdminMutation(onSaved);
  return (
    <section className="academic-editor-panel">
      <h3>Assignment configuration</h3>
      <p className="admin-muted">
        Existing submissions, versions and feedback remain immutable. Acceptance
        policy cannot change after submissions. Operational grading is outside
        A2.
      </p>
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const date = String(f.get('due') || '');
          await mutation.save(`${path}/assignment`, {
            instructions: f.get('instructions'),
            dueAt: date ? new Date(date).toISOString() : null,
            allowedKinds: ['TEXT', 'FILE', 'TEXT_AND_FILE'].filter((k) =>
              f.has(k),
            ),
            maxFiles: Number(f.get('files')),
            maxFileBytes: Number(f.get('bytes')),
            requiresAcceptance: f.has('acceptance'),
            allowResubmission: f.has('resubmission'),
          });
        }}
      >
        <Field label="Assignment instructions">
          <textarea
            name="instructions"
            required
            maxLength={12000}
            defaultValue={a?.instructions || ''}
          />
        </Field>
        <fieldset>
          <legend>Allowed submission modes</legend>
          {['TEXT', 'FILE', 'TEXT_AND_FILE'].map((k) => (
            <label key={k} className="academic-check">
              <input
                name={k}
                type="checkbox"
                defaultChecked={
                  a ? a.allowedKinds.includes(k as 'TEXT') : k === 'TEXT'
                }
              />
              {k}
            </label>
          ))}
        </fieldset>
        <Field label="Due date (local time, optional)">
          <input
            name="due"
            type="datetime-local"
            defaultValue={
              a?.dueAt
                ? new Date(
                    new Date(a.dueAt).getTime() -
                      new Date(a.dueAt).getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)
                : ''
            }
          />
        </Field>
        <div className="academic-form-grid">
          <Field label="Maximum files (0–5)">
            <input
              name="files"
              type="number"
              required
              min={0}
              max={5}
              defaultValue={a?.maxFiles ?? 3}
            />
          </Field>
          <Field label="Maximum bytes per file (up to 10 MB)">
            <input
              name="bytes"
              type="number"
              required
              min={1}
              max={10485760}
              defaultValue={a?.maxFileBytes ?? 5242880}
            />
          </Field>
        </div>
        <label className="academic-check">
          <input
            name="acceptance"
            type="checkbox"
            defaultChecked={a?.requiresAcceptance ?? true}
          />{' '}
          Requires staff acceptance
        </label>
        <label className="academic-check">
          <input
            name="resubmission"
            type="checkbox"
            defaultChecked={a?.allowResubmission ?? true}
          />{' '}
          Allow resubmission after changes requested
        </label>
        <FormActions busy={mutation.busy} notice={mutation.notice} />
      </form>
    </section>
  );
}
