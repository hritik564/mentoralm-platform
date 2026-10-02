'use client';
import { LmsIcon } from './LmsPrimitives';
export function LmsSearch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="lms-search">
      <LmsIcon name="search" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
      />
    </label>
  );
}
export function LmsFilter({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="lms-filter">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function filterOptions(values: string[], all: string) {
  return [
    { value: '', label: all },
    ...Array.from(new Set(values)).map((value) => ({ value, label: value })),
  ];
}
