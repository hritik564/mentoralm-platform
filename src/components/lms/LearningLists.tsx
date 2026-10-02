'use client';
import { useState } from 'react';
import { LmsIcon, LmsStatusBadge } from './LmsPrimitives';
import { LmsSearch, LmsFilter, filterOptions } from './LmsFilters';
import Link from 'next/link';
import type { LearningCourse, LearningRepository } from '@/lib/lms/learning';
import { lmsHref, learningItemHref } from '@/lib/platform/domains';
export function LearningCourses({ courses }: { courses: LearningCourse[] }) {
  return courses.length ? (
    <ul className="lms-list l2-course-list">
      {courses.map((course) => (
        <li key={course.id}>
          <div className="lms-row-main">
            <span className="lms-eyebrow">{course.program || 'Course'}</span>
            <h3>{course.title}</h3>
            <progress
              aria-label={`Course progress: ${course.title}`}
              max="100"
              value={course.progress.percentage || 0}
            />
            <p>
              {course.progress.percentage === null
                ? 'No required learning items yet'
                : `${course.academicCompletionEnabled || course.hasAcademicItems ? 'Course' : 'Lesson'} progress ${course.progress.percentage}% · ${course.progress.completedItems}/${course.progress.requiredItems} required ${course.hasAcademicItems ? 'learning items' : 'lessons'}`}
            </p>
            {course.progress.nextItem && (
              <p>Next: {course.progress.nextItem.title}</p>
            )}
            {course.progress.lastAccessedAt && (
              <small>
                Last accessed{' '}
                <time dateTime={course.progress.lastAccessedAt}>
                  {new Date(course.progress.lastAccessedAt).toLocaleDateString(
                    'en-US',
                    { timeZone: 'UTC' },
                  )}
                </time>
              </small>
            )}
          </div>
          <Link
            className="lms-action"
            prefetch={false}
            href={
              course.progress.nextItem
                ? learningItemHref(course.id, course.progress.nextItem)
                : lmsHref(`/learn/courses/${course.id}`)
            }
          >
            Continue Learning<span className="sr-only">: {course.title}</span> →
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <p className="lms-empty">No enrolled courses with learning access yet.</p>
  );
}
export function LearningResources({
  resources,
}: {
  resources: Awaited<ReturnType<LearningRepository['resources']>>;
}) {
  const [search, setSearch] = useState(''),
    [section, setSection] = useState(''),
    [type, setType] = useState(''),
    [sort, setSort] = useState('outline');
  const visible = resources
    .filter(
      (r) =>
        r.title.toLowerCase().includes(search.toLowerCase()) &&
        (!section || r.section === section) &&
        (!type || r.mimeType === type),
    )
    .slice()
    .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : 0));
  return (
    <>
      <div className="lms-toolbar">
        <LmsSearch
          label="Search resources"
          value={search}
          onChange={setSearch}
        />
        <LmsFilter
          label="Section"
          value={section}
          onChange={setSection}
          options={filterOptions(
            resources.map((r) => r.section),
            'All sections',
          )}
        />
        <LmsFilter
          label="File type"
          value={type}
          onChange={setType}
          options={filterOptions(
            resources.map((r) => r.mimeType),
            'All types',
          )}
        />
        <LmsFilter
          label="Sort resources"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'outline', label: 'Course order' },
            { value: 'title', label: 'Title A–Z' },
          ]}
        />
        <span role="status" className="lms-result-count">
          {visible.length} resource{visible.length === 1 ? '' : 's'}
        </span>
      </div>
      {visible.length ? (
        <ul className="lms-dense-list">
          {visible.map((resource) => (
            <li className="lms-learning-row" key={resource.id}>
              <span className="lms-row-icon">
                <LmsIcon name="resource" />
              </span>
              <div className="lms-row-main">
                <span className="lms-eyebrow">
                  {resource.course} · {resource.section}
                </span>
                <h3>{resource.title}</h3>
                {resource.description && <p>{resource.description}</p>}
                <span className="lms-status">
                  {resource.mimeType.replace('application/', '')}
                </span>
              </div>
              {resource.available ? (
                <div className="l2-resource-actions">
                  <a
                    className="lms-action lms-action--secondary"
                    href={`/api/lms/courses/${resource.courseId}/resources/${resource.id}/media`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View ↗
                  </a>
                  {resource.downloadAllowed && (
                    <a
                      className="lms-action lms-action--secondary"
                      href={`/api/lms/courses/${resource.courseId}/resources/${resource.id}/media?download=1`}
                    >
                      Download
                    </a>
                  )}
                </div>
              ) : (
                <LmsStatusBadge status="Unavailable" />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="lms-empty">
          No learning resources available yet. Course materials shared with you
          will appear here.
        </p>
      )}
    </>
  );
}
