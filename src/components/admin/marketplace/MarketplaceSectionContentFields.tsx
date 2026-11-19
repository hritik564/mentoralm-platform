'use client';
import { useRef, useState } from 'react';
import type { AdminProgramSection } from '@/lib/marketplace/page-types';
import { MarketplacePageField as Field } from './MarketplacePageFields';

type Content = AdminProgramSection['content'];

function RepeatingFields<T>({
  initial,
  empty,
  noun,
  maximum,
  disabled,
  children,
}: {
  initial: T[];
  empty: T;
  noun: string;
  maximum: number;
  disabled: boolean;
  children: (item: T, index: number) => React.ReactNode;
}) {
  const [rows, setRows] = useState(() =>
    initial.map((value, key) => ({ key, value })),
  );
  const nextKey = useRef(initial.length);
  return (
    <div className="marketplace-content-fields">
      {rows.length === 0 && (
        <p className="admin-muted">
          No {noun.toLowerCase()} items yet. Add content below when it is ready.
        </p>
      )}
      {rows.map((row, index) => (
        <fieldset key={row.key} className="marketplace-content-item">
          <legend>
            {noun} {index + 1}
          </legend>
          {children(row.value, index)}
          <button
            className="admin-text-link marketplace-content-remove"
            type="button"
            disabled={disabled}
            aria-label={`Remove ${noun.toLowerCase()} ${index + 1}`}
            onClick={() =>
              setRows((current) =>
                current.filter((item) => item.key !== row.key),
              )
            }
          >
            Remove {noun.toLowerCase()}
          </button>
        </fieldset>
      ))}
      <div className="marketplace-content-add">
        <button
          className="admin-button secondary"
          type="button"
          disabled={disabled || rows.length >= maximum}
          onClick={() => {
            const key = nextKey.current++;
            setRows((current) => [...current, { key, value: empty }]);
          }}
        >
          Add {noun === 'FAQ' ? 'FAQ' : noun.toLowerCase()}
        </button>
        <small className="admin-muted">
          {rows.length} of {maximum} items
        </small>
      </div>
    </div>
  );
}

export function MarketplaceSectionContentFields({
  type,
  content,
  disabled,
}: {
  type: AdminProgramSection['type'];
  content?: Content;
  disabled: boolean;
}) {
  if (type === 'OVERVIEW' || type === 'TEXT') {
    return (
      <Field label="Body" help="Plain text. Paragraph breaks are preserved.">
        <textarea
          name="body"
          rows={9}
          maxLength={6000}
          defaultValue={content && 'body' in content ? content.body : ''}
        />
      </Field>
    );
  }
  if (type === 'CURRICULUM') {
    return (
      <RepeatingFields
        initial={content && 'modules' in content ? content.modules : []}
        empty={{ title: '', description: '' }}
        noun="Module"
        maximum={12}
        disabled={disabled}
      >
        {(item, index) => (
          <>
            <Field label={`Module title ${index + 1}`}>
              <input
                name="moduleTitle"
                maxLength={160}
                required
                defaultValue={item.title}
              />
            </Field>
            <Field label={`Module description ${index + 1}`}>
              <textarea
                name="moduleDescription"
                rows={4}
                maxLength={1200}
                defaultValue={item.description}
              />
            </Field>
          </>
        )}
      </RepeatingFields>
    );
  }
  if (type === 'FAQ') {
    const initial =
      content && 'items' in content
        ? content.items.filter(
            (item): item is { question: string; answer: string } =>
              typeof item !== 'string',
          )
        : [];
    return (
      <RepeatingFields
        initial={initial}
        empty={{ question: '', answer: '' }}
        noun="FAQ"
        maximum={12}
        disabled={disabled}
      >
        {(item, index) => (
          <>
            <Field label={`Question ${index + 1}`}>
              <input
                name="question"
                maxLength={240}
                required
                defaultValue={item.question}
              />
            </Field>
            <Field label={`Answer ${index + 1}`}>
              <textarea
                name="answer"
                rows={5}
                maxLength={2000}
                required
                defaultValue={item.answer}
              />
            </Field>
          </>
        )}
      </RepeatingFields>
    );
  }
  const noun = {
    OUTCOMES: 'Outcome',
    ELIGIBILITY: 'Requirement',
    WHO_IS_IT_FOR: 'Audience item',
    HIGHLIGHTS: 'Highlight',
  }[type];
  const initial =
    content && 'items' in content
      ? content.items.filter((item): item is string => typeof item === 'string')
      : [];
  return (
    <RepeatingFields
      initial={initial}
      empty=""
      noun={noun}
      maximum={20}
      disabled={disabled}
    >
      {(item, index) => (
        <Field label={`${noun} ${index + 1}`}>
          <textarea
            name="item"
            rows={2}
            maxLength={300}
            required
            defaultValue={item}
          />
        </Field>
      )}
    </RepeatingFields>
  );
}
