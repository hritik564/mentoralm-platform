/** Presentation snapshots only. Enrollment and progress remain domain-owned. */
export interface LearningLaunchTarget {
  destinationId: string;
}
export interface DashboardCourse {
  id: string;
  title: string;
  program: string;
  thumbnail: { src: string; alt: string };
  publicDestination: string;
}
export interface ViewedCourse extends DashboardCourse {
  kind: 'viewed';
  description: string;
  lastViewed: string | null;
}
export interface EnrolledCourse extends DashboardCourse {
  kind: 'enrolled';
  status: 'enrolled' | 'in-progress' | 'completed';
  progress: number | null;
  nextLesson: string | null;
  lastAccessed: string | null;
  learningTarget: LearningLaunchTarget | null;
}
export interface DashboardCourses {
  viewed: readonly ViewedCourse[];
  enrolled: readonly EnrolledCourse[];
}
export const exploreProgramsDestination = '/#programs';

export function publicCourseDestination(value: string): string | null {
  // Local discovery paths/fragments only; no query-string redirects or encoding.
  return /^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*(?:#[a-zA-Z0-9_-]+)?$/.test(
    value,
  )
    ? value
    : null;
}
