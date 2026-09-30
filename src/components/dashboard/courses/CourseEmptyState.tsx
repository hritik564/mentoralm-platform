import { exploreProgramsDestination } from '../../../lib/dashboard/courses';
import { DashboardIcon } from '../DashboardIcon';

export function CourseEmptyState({
  heading,
  description,
  compact = false,
}: {
  heading: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`d2-empty${compact ? ' d2-empty--compact' : ''}`}>
      <span className="d2-empty-icon" aria-hidden="true">
        <DashboardIcon name="courses" />
      </span>
      <h3>{heading}</h3>
      <p>{description}</p>
      <a href={exploreProgramsDestination} className="d2-action">
        Explore Programs <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}
