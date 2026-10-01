'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Assignments } from '@/lib/lms/assignments';
import { learningItemHref } from '@/lib/platform/domains';
export function AssignmentList({
  items,
}: {
  items: Awaited<ReturnType<Assignments['list']>>;
}) {
  const [filter, setFilter] = useState('All');
  const visible = items.filter(
    (i) =>
      filter === 'All' ||
      (filter === 'Pending'
        ? i.status === 'NOT_SUBMITTED'
        : filter === 'Needs Changes'
          ? i.status === 'CHANGES_REQUESTED'
          : filter === 'Accepted'
            ? i.status === 'ACCEPTED'
            : ['SUBMITTED', 'UNDER_REVIEW'].includes(i.status)),
  );
  return (
    <>
      <label htmlFor="assignment-filter">Assignment status</label>
      <select
        id="assignment-filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        {['All', 'Pending', 'Submitted', 'Needs Changes', 'Accepted'].map(
          (f) => (
            <option key={f}>{f}</option>
          ),
        )}
      </select>
      {visible.length ? (
        <ul className="lms-list">
          {visible.map((i) => (
            <li key={i.id}>
              <div>
                <span className="lms-eyebrow">{i.course}</span>
                <h2>{i.title}</h2>
                <p>
                  {i.status.replaceAll('_', ' ').toLowerCase()}
                  {i.dueAt &&
                    ` · Due ${new Date(i.dueAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}`}
                </p>
              </div>
              <Link
                className="lms-action"
                href={learningItemHref(i.courseId, {
                  id: i.id,
                  type: 'ASSIGNMENT',
                })}
              >
                Open assignment<span className="sr-only">: {i.title}</span> →
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lms-empty">No assignments in this view.</p>
      )}
    </>
  );
}
