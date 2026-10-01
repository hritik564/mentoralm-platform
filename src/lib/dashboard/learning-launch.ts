import type { LearningLaunchTarget } from './courses';
import { lmsHref, learningItemHref } from '../platform/domains';

export interface LearningLaunchRegistry {
  /** Deployment-owned destinations, never supplied by students/course URL input. */
  destinations: Readonly<Record<string, string>>;
  trustedOrigins: readonly string[];
}
// Approved internal LMS course routes; external registry policy remains unchanged.
const deploymentRegistry: LearningLaunchRegistry = {
  destinations: {},
  trustedOrigins: [],
};

/** A link resolver, not an access grant. LMS must authorize every launch itself. */
export function resolveLearningLaunch(
  target: LearningLaunchTarget | null,
  registry: LearningLaunchRegistry = deploymentRegistry,
): string | null {
  if (!target || !/^[a-zA-Z0-9_-]+$/.test(target.destinationId)) return null;
  if (
    registry === deploymentRegistry &&
    target.destinationId.startsWith('lms-course-')
  ) {
    const courseId = target.destinationId.slice('lms-course-'.length);
    if (target.item) {
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(courseId) ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(target.item.id) ||
        !['LESSON', 'QUIZ', 'ASSESSMENT', 'ASSIGNMENT'].includes(
          target.item.type,
        )
      )
        return null;
      return learningItemHref(courseId, target.item);
    }
    if (target.lessonId !== undefined) {
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(courseId) ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(target.lessonId)
      )
        return null;
      return lmsHref(`/learn/courses/${courseId}/lessons/${target.lessonId}`);
    }
    return /^[a-zA-Z0-9_-]{1,100}$/.test(courseId)
      ? lmsHref(`/learn/courses/${courseId}`)
      : null;
  }
  if (!Object.hasOwn(registry.destinations, target.destinationId)) return null;
  const destination = registry.destinations[target.destinationId];
  if (!destination || /[\\\s%?#]/.test(destination)) return null;
  if (/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+$/.test(destination))
    return destination;
  try {
    const url = new URL(destination);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !registry.trustedOrigins.includes(url.origin) ||
      !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(url.pathname) ||
      destination !== `${url.origin}${url.pathname}`
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
