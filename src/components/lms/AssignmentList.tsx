'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Assignments } from '@/lib/lms/assignments';
import { LmsSearch, LmsFilter, filterOptions } from './LmsFilters';
import { LmsIcon, LmsStatusBadge } from './LmsPrimitives';
import { learningItemHref } from '@/lib/platform/domains';
export function AssignmentList({
  items,
}: {
  items: Awaited<ReturnType<Assignments['list']>>;
}) {
  const [filter, setFilter] = useState('All'),
    [search, setSearch] = useState(''),
    [course, setCourse] = useState('');
  const statuses: Record<string, string> = {
    Pending: 'NOT_SUBMITTED',
    Submitted: 'SUBMITTED',
    'Under Review': 'UNDER_REVIEW',
    'Needs Changes': 'CHANGES_REQUESTED',
    Accepted: 'ACCEPTED',
  };
  const visible = items.filter(
    (i) =>
      (!course || i.course === course) &&
      i.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'All' || i.status === statuses[filter]),
  );
  return (
    <>
      <div className="lms-toolbar">
        <LmsSearch
          label="Search assignments"
          value={search}
          onChange={setSearch}
        />
        <LmsFilter
          label="Assignment status"
          value={filter}
          onChange={setFilter}
          options={[
            'All',
            'Pending',
            'Submitted',
            'Under Review',
            'Needs Changes',
            'Accepted',
          ].map((value) => ({
            value,
            label: value === 'All' ? 'All statuses' : value,
          }))}
        />
        <LmsFilter
          label="Course"
          value={course}
          onChange={setCourse}
          options={filterOptions(
            items.map((i) => i.course),
            'All courses',
          )}
        />
        <span className="lms-result-count" role="status">
          {visible.length} assignment{visible.length === 1 ? '' : 's'}
        </span>
      </div>
      {visible.length ? (
        <ul className="lms-dense-list lms-assignment-list">
          {visible.map((i) => (
            <li className="lms-learning-row" key={i.id}>
              <span className="lms-row-icon">
                <LmsIcon name="assignment" />
              </span>
              <div className="lms-row-main">
                <h2>{i.title}</h2>

                <p>
                  {i.course} · {i.dueAt ? '' : 'No due date'}
                  {i.dueAt &&
                    ` · Due ${new Date(i.dueAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}`}
                </p>
              </div>
              <LmsStatusBadge status={i.status} />
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
