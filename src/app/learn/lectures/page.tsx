import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { getLearningRepository } from '@/lib/lms/services';
import { LearningCourses } from '@/components/lms/LearningLists';
import Link from 'next/link';
import { learningItemHref } from '@/lib/platform/domains';
export default function Lectures() {
  return (
    <LmsBoundary
      load={async () => {
        const courses = await (await getLearningRepository()).courses();
        return (
          <>
            <p className="lms-eyebrow">Learn</p>
            <h1>Lectures</h1>
            <p className="lms-intro">
              Self-paced lessons in your enrolled courses.
            </p>
            <section className="lms-panel">
              <LearningCourses courses={courses} />
            </section>
            {courses.map((course) => (
              <section className="lms-panel l2-discovery" key={course.id}>
                <h2>{course.title}</h2>
                {course.sections.map((section) => (
                  <div key={section.position}>
                    <h3>{section.title}</h3>
                    <ul>
                      {section.items.map((item) => (
                        <li key={item.id}>
                          {(item.type === 'LESSON' && item.lesson) ||
                          item.completion?.eligible ? (
                            <Link
                              prefetch={false}
                              href={learningItemHref(course.id, item)}
                            >
                              {item.title}{' '}
                              <span>
                                {item.completedAt
                                  ? 'Completed'
                                  : item.required
                                    ? 'Required'
                                    : 'Optional'}
                              </span>
                            </Link>
                          ) : (
                            <span>
                              {item.title} · {item.type.toLowerCase()} ·{' '}
                              {item.type === 'RESOURCE'
                                ? 'See Resources'
                                : 'Not available yet'}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </>
        );
      }}
    />
  );
}
