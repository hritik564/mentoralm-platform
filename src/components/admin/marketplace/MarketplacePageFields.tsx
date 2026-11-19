'use client';
import { cloneElement, isValidElement, useId } from 'react';

export function MarketplacePageField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="marketplace-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
        ? cloneElement(children, {
            id,
            ...(help ? { 'aria-describedby': `${id}-help` } : {}),
          })
        : children}
      {help && <small id={`${id}-help`}>{help}</small>}
    </div>
  );
}

export const sectionLabels = {
  OVERVIEW: 'Overview',
  OUTCOMES: 'Outcomes',
  CURRICULUM: 'Curriculum',
  ELIGIBILITY: 'Eligibility',
  WHO_IS_IT_FOR: 'Who is it for',
  HIGHLIGHTS: 'Program highlights',
  FAQ: 'FAQ',
  TEXT: 'Text',
} as const;
