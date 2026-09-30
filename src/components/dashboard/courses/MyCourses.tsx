'use client';
import { useRef, useState, type KeyboardEvent } from 'react';
import type { DashboardCourses } from '../../../lib/dashboard/courses';
import { CourseCard } from './CourseCard';
import { CourseEmptyState } from './CourseEmptyState';

const tabs = ['Enrolled Courses', 'Viewed Courses'] as const;
export function MyCourses({ courses }: { courses: DashboardCourses }) {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function switchTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (index + tabs.length - 1) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  }
  return (
    <section className="d2-courses-page">
      <p className="dashboard-eyebrow">Your learning space</p>
      <h1>My Courses</h1>
      <p className="d2-page-description">
        Keep the courses you explore and the learning you start in one place.
      </p>
      <div className="d2-tabs" role="tablist" aria-label="Course views">
        {tabs.map((label, index) => (
          <button
            key={label}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            role="tab"
            id={`course-tab-${index}`}
            aria-selected={selected === index}
            aria-controls={`course-panel-${index}`}
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => switchTab(event, index)}
          >
            {label}
          </button>
        ))}
      </div>
      {tabs.map((label, index) => {
        const records = index === 0 ? courses.enrolled : courses.viewed;
        return (
          <div
            key={label}
            role="tabpanel"
            id={`course-panel-${index}`}
            aria-labelledby={`course-tab-${index}`}
            hidden={selected !== index}
            tabIndex={0}
            className="d2-tab-panel"
          >
            {records.length ? (
              <div className="d2-course-grid">
                {records.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <CourseEmptyState
                heading={
                  index === 0
                    ? "You haven't enrolled in a course yet."
                    : 'Courses you explore will appear here.'
                }
                description={
                  index === 0
                    ? 'Discover a program that fits your next step.'
                    : 'Return here to revisit courses once course discovery is available.'
                }
              />
            )}
          </div>
        );
      })}
    </section>
  );
}
