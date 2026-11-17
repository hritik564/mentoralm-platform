'use client';
import Link from 'next/link';
import { adminHref } from '@/lib/platform/domains';
import { useAdminAccess } from '../AdminShell';
import { useAdminData } from '../client';
import { Pill, State } from '../Primitives';
import type { Builder } from './types';

export const courseSections = [
  { key: 'overview', label: 'Overview' },
  { key: 'curriculum', label: 'Curriculum' },
  { key: 'batches', label: 'Batches' },
  { key: 'classes', label: 'Classes' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'resources', label: 'Resources' },
  { key: 'certificates', label: 'Certificates' },
] as const;
export type CourseSection = (typeof courseSections)[number]['key'];
type CourseItem = { section: string; ref: string };

export function CourseNavigation({
  active,
  certificates,
  onChange,
}: {
  active: CourseSection;
  certificates: boolean;
  onChange: (section: CourseSection) => void;
}) {
  return (
    <div
      className="admin-tabs learning-context-nav"
      role="group"
      aria-label="Course sections"
    >
      {courseSections
        .filter((section) => section.key !== 'certificates' || certificates)
        .map((section) => (
          <button
            key={section.key}
            aria-pressed={active === section.key}
            onClick={() => onChange(section.key)}
          >
            {section.label}
          </button>
        ))}
    </div>
  );
}

export function CourseContext({
  course,
  section,
  onOpenItem,
  onSectionChange,
}: {
  course: Builder;
  section: CourseSection;
  onOpenItem: (item: CourseItem) => void;
  onSectionChange: (section: CourseSection) => void;
}) {
  const { permissions } = useAdminAccess();
  const batches = useAdminData<{ ref: string; name: string }[]>(
    section === 'batches'
      ? `academic/live-batches?course=${encodeURIComponent(course.ref)}`
      : null,
  );
  const courseQuery = new URLSearchParams({ course: course.ref }).toString(),
    items = course.sections.flatMap((s) =>
      s.items.map((item) => ({ ...item, sectionRef: s.ref, section: s.title })),
    );
  if (section === 'overview')
    return (
      <section className="admin-card learning-context-panel">
        <h2>Course overview</h2>
        {course.description && <p>{course.description}</p>}
        <dl className="admin-key-values learning-course-overview">
          <div>
            <dt>Status</dt>
            <dd>{course.published ? 'Published' : 'Draft'}</dd>
          </div>
          <div>
            <dt>Sections</dt>
            <dd>{course.sections.length}</dd>
          </div>
          <div>
            <dt>Learning items</dt>
            <dd>{items.length}</dd>
          </div>
        </dl>
        <div className="learning-context-actions">
          <button
            className="admin-button"
            onClick={() => onSectionChange('curriculum')}
          >
            Open Curriculum
          </button>
          <button
            className="admin-button secondary"
            onClick={() => onSectionChange('batches')}
          >
            View Batches
          </button>
        </div>
      </section>
    );
  if (section === 'batches')
    return (
      <section className="admin-card learning-context-panel">
        <h2>Compatible batches</h2>
        <p className="admin-muted learning-context-note">
          Batches available for this course’s live sessions, including course,
          program and unscoped batches. Showing up to 50.
        </p>
        <State {...batches} />
        {batches.data && (
          <>
            <ul className="learning-context-list">
              {batches.data.map((batch) => (
                <li className="learning-context-row" key={batch.ref}>
                  <strong>{batch.name}</strong>
                  {permissions.includes('BATCHES_MANAGE') && (
                    <Link
                      className="admin-text-link"
                      href={adminHref(`/admin/batches/${batch.ref}`)}
                    >
                      Open Batch →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            {!batches.data.length && (
              <p className="admin-empty">No compatible batches available.</p>
            )}
          </>
        )}
      </section>
    );
  if (section === 'certificates')
    return permissions.includes('CERTIFICATES_MANAGE') ? (
      <section className="admin-card learning-context-panel">
        <h2>Course certificates</h2>
        <p>Review issued certificates, eligibility and existing holds.</p>
        <p className="admin-muted">
          Certificates are {course.certificateEnabled ? 'enabled' : 'disabled'}{' '}
          for this course. Existing policy controls eligibility and issuance.
        </p>
        <Link
          className="admin-button secondary"
          href={`${adminHref('/admin/certificates')}?${courseQuery}`}
        >
          Open Course Certificates
        </Link>
      </section>
    ) : null;

  if (section === 'curriculum') return null;
  const content = {
    classes: {
      title: 'Course classes',
      description:
        'Open a live class item to manage its existing batch occurrences.',
      types: ['LIVE_SESSION'],
      empty: 'No live class items yet. Add a Live Session in Curriculum.',
    },
    assignments: {
      title: 'Course assignments',
      description: 'Configure assignments and review submitted work.',
      types: ['ASSIGNMENT'],
      empty: 'No assignments yet. Add an Assignment in Curriculum.',
    },
    assessments: {
      title: 'Course assessments',
      description: 'Configure quizzes and assessments, then review responses.',
      types: ['QUIZ', 'ASSESSMENT'],
      empty: 'No assessments yet. Add a Quiz or Assessment in Curriculum.',
    },
    resources: {
      title: 'Course resources',
      description: 'Open a resource to manage its existing content and file.',
      types: ['RESOURCE'],
      empty: 'No resources yet. Add a Resource in Curriculum.',
    },
  }[section];
  const filtered = items.filter((item) => content.types.includes(item.type));
  return (
    <section className="admin-card learning-context-panel">
      <div className="learning-context-heading">
        <div>
          <h2>{content.title}</h2>
          <p className="admin-muted">{content.description}</p>
        </div>
        <div className="learning-context-actions">
          {section === 'assignments' && (
            <>
              <Link
                className="admin-button secondary"
                href={`${adminHref('/admin/submissions')}?${courseQuery}`}
              >
                Review submissions
              </Link>
              <Link
                className="admin-text-link"
                href={adminHref('/admin/assignments')}
              >
                All assignments
              </Link>
            </>
          )}
          {section === 'assessments' && (
            <>
              <Link
                className="admin-button secondary"
                href={`${adminHref('/admin/attempts')}?${courseQuery}`}
              >
                Review responses
              </Link>
              <Link
                className="admin-text-link"
                href={adminHref('/admin/assessments')}
              >
                Question banks &amp; all assessments
              </Link>
            </>
          )}
          {section === 'classes' &&
            permissions.includes('ATTENDANCE_MANAGE') && (
              <Link
                className="admin-button secondary"
                href={`${adminHref('/admin/attendance')}?${courseQuery}`}
              >
                Course attendance
              </Link>
            )}
        </div>
      </div>
      <ul className="learning-context-list">
        {filtered.map((item) => (
          <li className="learning-context-row" key={item.ref}>
            <div>
              <strong>{item.title}</strong>
              <div className="learning-context-meta">
                <span>{item.section}</span>
                {section === 'assessments' && (
                  <span>{item.type === 'QUIZ' ? 'Quiz' : 'Assessment'}</span>
                )}
                {section === 'classes' && (
                  <span>{item.occurrences} batch occurrences</span>
                )}
                <Pill>{item.published ? 'PUBLISHED' : 'DRAFT'}</Pill>
              </div>
            </div>
            <button
              className="admin-button secondary"
              onClick={() =>
                onOpenItem({ section: item.sectionRef, ref: item.ref })
              }
            >
              Open{' '}
              {section === 'classes'
                ? 'class'
                : section === 'resources'
                  ? 'resource'
                  : section === 'assignments'
                    ? 'assignment'
                    : 'assessment'}
            </button>
          </li>
        ))}
      </ul>
      {!filtered.length && <p className="admin-empty">{content.empty}</p>}
      <button
        className="admin-text-link"
        onClick={() => onSectionChange('curriculum')}
      >
        Open Curriculum →
      </button>
    </section>
  );
}
