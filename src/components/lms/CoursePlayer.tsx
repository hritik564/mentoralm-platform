'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LearningCourse, LearningRepository } from '@/lib/lms/learning';
import { lmsHref } from '@/lib/platform/domains';
type Lesson = Awaited<ReturnType<LearningRepository['lesson']>>;
export function ProgressLabel({
  progress,
}: {
  progress:
    LearningCourse['progress'] | LearningCourse['sections'][number]['progress'];
}) {
  return (
    <div className="l2-progress">
      <span>
        Lesson progress{' '}
        <strong>
          {progress.percentage === null
            ? 'No required lessons'
            : `${progress.percentage}%`}
        </strong>
      </span>
      {progress.percentage !== null && (
        <progress
          aria-label="Required lesson progress"
          value={progress.completedItems}
          max={progress.requiredItems}
        />
      )}
      <small>
        {progress.completedItems} of {progress.requiredItems} required lessons
        complete
      </small>
    </div>
  );
}
function Outline({
  course,
  current,
  onSelect,
}: {
  course: LearningCourse;
  current: string | null;
  onSelect?: () => void;
}) {
  return (
    <nav aria-label="Course outline">
      {course.sections.map((section) => (
        <section className="l2-outline-section" key={section.position}>
          <h3>{section.title}</h3>
          <span>
            {section.progress.completedItems}/{section.progress.requiredItems}{' '}
            required lessons
            {section.progress.percentage !== null
              ? ` · ${section.progress.percentage}%`
              : ''}
          </span>
          <ol>
            {section.items.map((item) => (
              <li key={item.id}>
                {item.type === 'LESSON' && item.lesson ? (
                  <Link
                    prefetch={false}
                    onClick={onSelect}
                    href={lmsHref(
                      `/learn/courses/${course.id}/lessons/${item.id}`,
                    )}
                    aria-current={current === item.id ? 'page' : undefined}
                  >
                    <span aria-hidden="true">
                      {item.completedAt ? '✓' : current === item.id ? '→' : '○'}
                    </span>
                    <span>
                      {item.title}
                      <small>
                        {item.completedAt ? 'Completed · ' : ''}
                        {item.required ? 'Required' : 'Optional'} ·{' '}
                        {item.lesson.format.toLowerCase()}
                      </small>
                    </span>
                  </Link>
                ) : (
                  <div className="l2-future-item">
                    <span>
                      {item.title}
                      <small>
                        {item.type.toLowerCase().replace('_', ' ')} ·{' '}
                        {item.type === 'RESOURCE'
                          ? 'See course resources'
                          : 'Not available yet'}
                      </small>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </nav>
  );
}
function OutlineDrawer({
  course,
  current,
  onClose,
  dialogId,
}: {
  dialogId: string;
  course: LearningCourse;
  current: string | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    const element = ref.current;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      id={dialogId}
      className="l2-drawer"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        const controls = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled])',
          ),
        ].filter((el) => el.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <header>
        <h2 id={id}>Course Outline</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close course outline"
        >
          ✕
        </button>
      </header>
      <Outline course={course} current={current} onSelect={onClose} />
    </dialog>
  );
}
export function CoursePlayer({
  course,
  lesson,
  children,
}: {
  course: LearningCourse;
  lesson: Lesson | null;
  children: React.ReactNode;
}) {
  const outlineId = useId();
  const [drawer, setDrawer] = useState(false),
    [saving, setSaving] = useState(false),
    [feedback, setFeedback] = useState('');
  const accessed = useRef<string | null>(null);
  const router = useRouter();
  const current = lesson?.id || null,
    lessons = course.sections
      .flatMap((s) => s.items)
      .filter((i) => i.type === 'LESSON' && i.lesson),
    index = lessons.findIndex((i) => i.id === current),
    previous = index > 0 ? lessons[index - 1] : null,
    next = index >= 0 ? lessons[index + 1] || null : null;
  useEffect(() => {
    if (!current || accessed.current === current) return;
    accessed.current = current;
    let alive = true;
    fetch(`/api/lms/courses/${course.id}/lessons/${current}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => {
        if (!r.ok && alive)
          setFeedback(
            'Last access could not be saved. Please reload to try again.',
          );
      })
      .catch(() => {
        if (alive)
          setFeedback(
            'Last access could not be saved. Please reload to try again.',
          );
      });
    return () => {
      alive = false;
    };
  }, [course.id, current]);
  async function complete() {
    if (!current) return;
    setSaving(true);
    setFeedback('');
    try {
      const r = await fetch(
        `/api/lms/courses/${course.id}/lessons/${current}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        },
      );
      if (!r.ok) throw Error();
      setFeedback('Lesson complete. Your progress is saved.');
      router.refresh();
    } catch {
      setFeedback(
        'Completion could not be saved. Check your access and try again.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="l2-player">
      <header className="l2-course-heading">
        <div>
          <Link className="lms-back" href={lmsHref('/learn/lectures')}>
            ← All courses
          </Link>
          <p className="lms-eyebrow">{course.program || 'Self-paced course'}</p>
          <h1>{course.title}</h1>
        </div>
        <ProgressLabel progress={course.progress} />
      </header>
      <button
        className="l2-outline-toggle"
        type="button"
        onClick={() => setDrawer(true)}
        aria-haspopup="dialog"
        aria-expanded={drawer}
        aria-controls={outlineId}
      >
        Course Outline
      </button>
      <div className="l2-workspace">
        <aside className="l2-outline">
          <h2>Course Outline</h2>
          <Outline course={course} current={current} />
        </aside>
        <article className="l2-content">
          {lesson ? (
            <>
              <p className="lms-eyebrow">
                {lesson.format.toLowerCase()} lesson
              </p>
              <h2>{lesson.title}</h2>
              {children}
              <footer className="l2-lesson-actions">
                <div>
                  {previous && (
                    <Link
                      prefetch={false}
                      href={lmsHref(
                        `/learn/courses/${course.id}/lessons/${previous.id}`,
                      )}
                    >
                      ← Previous
                    </Link>
                  )}
                  {next && (
                    <Link
                      prefetch={false}
                      href={lmsHref(
                        `/learn/courses/${course.id}/lessons/${next.id}`,
                      )}
                    >
                      Next →
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  onClick={complete}
                  disabled={saving || lesson.completed || !lesson.available}
                >
                  {lesson.completed
                    ? '✓ Lesson completed'
                    : saving
                      ? 'Saving…'
                      : 'Mark Complete'}
                </button>
              </footer>
              <p className="l2-feedback" role="status">
                {feedback}
              </p>
            </>
          ) : (
            <>
              <h2>Your course workspace</h2>
              <p>{course.description}</p>
              <p>
                Complete lessons at your own pace. Lesson progress does not
                represent final course completion or certificate eligibility.
              </p>
              {course.progress.nextLesson ? (
                <Link
                  className="lms-action"
                  prefetch={false}
                  href={lmsHref(
                    `/learn/courses/${course.id}/lessons/${course.progress.nextLesson.id}`,
                  )}
                >
                  Continue Learning: {course.progress.nextLesson.title} →
                </Link>
              ) : (
                <p>
                  {lessons.length
                    ? 'All current lessons complete.'
                    : 'No published lessons are available yet.'}
                </p>
              )}
              {children}
            </>
          )}
        </article>
      </div>
      {drawer && (
        <OutlineDrawer
          course={course}
          current={current}
          dialogId={outlineId}
          onClose={() => setDrawer(false)}
        />
      )}
    </div>
  );
}
