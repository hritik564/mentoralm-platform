'use client';
import { useState } from 'react';
import type {
  AdminProgramSection,
  ProgramSectionInput,
} from '@/lib/marketplace/page-types';
import {
  MarketplacePageField as Field,
  sectionLabels,
} from './MarketplacePageFields';
import { MarketplaceSectionContentFields } from './MarketplaceSectionContentFields';

type SectionType = AdminProgramSection['type'];
export type MarketplaceSectionInput = ProgramSectionInput;

export function MarketplaceSectionEditor({
  section,
  disabled,
  busy,
  onSave,
  onCancel,
}: {
  section?: AdminProgramSection;
  disabled: boolean;
  busy: boolean;
  onSave: (input: MarketplaceSectionInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<SectionType>(section?.type || 'OVERVIEW');
  const [title, setTitle] = useState(section?.title || sectionLabels.OVERVIEW);
  return (
    <form
      className="admin-card marketplace-form-section marketplace-page-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const common = {
          title,
          subtitle: String(form.get('subtitle') || '').trim() || null,
          enabled: form.has('enabled'),
        };
        let input: MarketplaceSectionInput;
        if (type === 'OVERVIEW' || type === 'TEXT') {
          input = {
            ...common,
            type,
            content: { body: String(form.get('body') || '') },
          };
        } else if (type === 'CURRICULUM') {
          const descriptions = form.getAll('moduleDescription');
          input = {
            ...common,
            type,
            content: {
              modules: form.getAll('moduleTitle').map((value, index) => ({
                title: String(value),
                description: String(descriptions[index] || ''),
              })),
            },
          };
        } else if (type === 'FAQ') {
          const answers = form.getAll('answer');
          input = {
            ...common,
            type,
            content: {
              items: form.getAll('question').map((value, index) => ({
                question: String(value),
                answer: String(answers[index] || ''),
              })),
            },
          };
        } else {
          input = {
            ...common,
            type,
            content: { items: form.getAll('item').map(String) },
          };
        }
        await onSave(input);
      }}
    >
      <header>
        <h2>{section ? 'Edit section' : 'Add section'}</h2>
        <p className="admin-muted">
          Edit the page draft with plain text and structured content. Save the
          draft before publishing page changes.
        </p>
      </header>
      <fieldset className="marketplace-form-fields" disabled={disabled}>
        <div className="marketplace-fields-pair">
          <Field
            label="Section type"
            help={
              section
                ? 'The type of an existing section is kept while editing.'
                : 'Choose how this section presents its content.'
            }
          >
            <select
              autoFocus={!section}
              value={type}
              disabled={!!section || disabled}
              onChange={(event) => {
                const next = event.target.value as SectionType;
                if (title === sectionLabels[type])
                  setTitle(sectionLabels[next]);
                setType(next);
              }}
            >
              {Object.entries(sectionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Section title">
            <input
              autoFocus={!!section}
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              required
            />
          </Field>
        </div>
        <Field label="Section subtitle (optional)">
          <textarea
            name="subtitle"
            rows={2}
            maxLength={300}
            defaultValue={section?.subtitle || ''}
          />
        </Field>
        <label className="marketplace-check">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={section?.enabled ?? true}
          />
          <span>
            Show this section
            <small>
              Included when you publish page changes. The offering must also be
              Published for visitors to see it. Empty sections remain hidden.
            </small>
          </span>
        </label>
        <MarketplaceSectionContentFields
          key={type}
          type={type}
          content={section?.content}
          disabled={disabled}
        />
      </fieldset>
      <div className="admin-actions marketplace-page-form-actions">
        <button className="admin-button" type="submit" disabled={disabled}>
          {busy ? 'Saving…' : 'Save Section Draft'}
        </button>
        <button
          className="admin-button secondary"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
