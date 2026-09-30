import type { LearningLaunchTarget } from './courses';

export interface LearningLaunchRegistry {
  /** Deployment-owned destinations, never supplied by students/course URL input. */
  destinations: Readonly<Record<string, string>>;
  trustedOrigins: readonly string[];
}
// No LMS has been selected. D2 must not expose a speculative learning route.
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
