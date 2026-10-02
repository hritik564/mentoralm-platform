'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { LearningCourse } from '@/lib/lms/learning';
import { learningItemHref, lmsHref } from '@/lib/platform/domains';
import { LmsSearch, LmsFilter, filterOptions } from './LmsFilters';
import { LmsIcon, LmsStatusBadge, LmsEmptyState } from './LmsPrimitives';
export function LectureList({ courses }: { courses: LearningCourse[] }) {
  const [search, setSearch] = useState(''),
    [section, setSection] = useState(''),
    [status, setStatus] = useState('');
  const rows = courses.flatMap((course) =>
    course.sections.flatMap((section) =>
      section.items.map((item) => ({ course, section, item })),
    ),
  );
  const visible = rows.filter(
    (r) =>
      (!search ||
        `${r.item.title} ${r.course.title}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!section || r.section.title === section) &&
      (!status ||
        (status === 'Completed' ? !!r.item.completedAt : !r.item.completedAt)),
  );
  return (
    <>
      {courses.map((c) => (
        <div className="lms-course-context" key={c.id}>
          <span className="lms-row-icon">
            <LmsIcon name="learn" />
          </span>
          <div>
            <span className="lms-eyebrow">{c.program || 'Course'}</span>
            <h2>{c.title}</h2>
            <p>
              {c.progress.nextItem
                ? `Next: ${c.progress.nextItem.title}`
                : 'Your learning outline'}
            </p>
          </div>
          <Link
            className="lms-action lms-action--secondary"
            href={lmsHref(`/learn/courses/${c.id}`)}
          >
            View course →
          </Link>
        </div>
      ))}
      <div className="lms-toolbar">
        <LmsSearch
          label="Search lectures"
          value={search}
          onChange={setSearch}
        />
        <LmsFilter
          label="Section"
          value={section}
          onChange={setSection}
          options={filterOptions(
            rows.map((r) => r.section.title),
            'All sections',
          )}
        />
        <LmsFilter
          label="Learning status"
          value={status}
          onChange={setStatus}
          options={filterOptions(
            ['Completed', 'Not completed'],
            'All statuses',
          )}
        />
        <span className="lms-result-count" role="status">
          {visible.length} learning items
        </span>
      </div>
      {visible.length ? (
        <ul className="lms-dense-list">
          {visible.map(({ course, section, item }) => {
            const supported =
              (item.type === 'LESSON' && item.lesson) ||
              (item.completion?.eligible &&
                ['QUIZ', 'ASSESSMENT', 'ASSIGNMENT'].includes(item.type));
            const href =
              item.type === 'RESOURCE'
                ? lmsHref('/learn/resources')
                : supported
                  ? learningItemHref(course.id, item)
                  : null;
            const content = (
              <>
                <span className="lms-row-icon">
                  <LmsIcon
                    name={
                      item.type === 'LESSON'
                        ? 'lesson'
                        : item.type === 'ASSIGNMENT'
                          ? 'assignment'
                          : item.type === 'RESOURCE'
                            ? 'resource'
                            : 'quiz'
                    }
                  />
                </span>
                <div className="lms-row-main">
                  <h3>{item.title}</h3>
                  <p>
                    {course.title} · {section.title}
                  </p>
                </div>
                <div className="lms-row-tags">
                  <span className="lms-status">
                    {item.lesson?.format.toLowerCase() ||
                      item.type.toLowerCase().replace('_', ' ')}
                  </span>
                  <span className="lms-status">
                    {item.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                <LmsStatusBadge
                  status={
                    item.completedAt
                      ? 'Completed'
                      : item.type === 'RESOURCE'
                        ? 'See Resources'
                        : supported
                          ? 'Not started'
                          : 'Unavailable'
                  }
                />
                <span aria-hidden="true">{href ? '›' : '—'}</span>
              </>
            );
            return (
              <li key={item.id}>
                {href ? (
                  <Link
                    className="lms-learning-row"
                    href={href}
                    prefetch={false}
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="lms-learning-row">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <LmsEmptyState
          title="No learning items in this view"
          description="Try another search or section filter."
        />
      )}
    </>
  );
}
