export type ResourceCategory = 'notes' | 'documents' | 'certificates' | 'other';
export interface ResourceAccess {
  scope: 'assigned' | 'available';
  downloadTargetId: string | null;
}
export type ResourcePreview =
  { kind: 'pdf' | 'image'; targetId: string } | { kind: 'text'; text: string };
export interface Resource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  mimeType: string;
  fileName: string;
  sizeBytes: number | null;
  publishedAt: string | null;
  program: string | null;
  course: string | null;
  preview: ResourcePreview | null;
  access: ResourceAccess;
}
export interface ResourceRegistry {
  /** Admin/server-controlled target IDs. UI capabilities never grant access. */
  targets: Readonly<Record<string, string>>;
  trustedOrigins: readonly string[];
}
const registry: ResourceRegistry = { targets: {}, trustedOrigins: [] };
export const resourceFilters = [
  { value: 'all', label: 'All' },
  { value: 'notes', label: 'Notes' },
  { value: 'documents', label: 'PDFs / Documents' },
  { value: 'certificates', label: 'Certificates' },
  { value: 'other', label: 'Other' },
] as const;
export function getStudentResources(): readonly Resource[] {
  return [];
}

export function resolveResourceTarget(
  targetId: string | null,
  config: ResourceRegistry = registry,
): string | null {
  if (
    !targetId ||
    !/^[a-zA-Z0-9_-]+$/.test(targetId) ||
    !Object.hasOwn(config.targets, targetId)
  )
    return null;
  const target = config.targets[targetId];
  // Signed URLs belong behind an authorized server endpoint in D4, not raw UI input.
  if (!target || /[\\\s%?#]/.test(target)) return null;
  if (/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9]+)?$/.test(target))
    return target;
  try {
    const url = new URL(target);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !config.trustedOrigins.includes(url.origin) ||
      !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9]+)?$/.test(
        url.pathname,
      ) ||
      target !== `${url.origin}${url.pathname}`
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function safeResourcePreview(
  resource: Resource,
  config?: ResourceRegistry,
):
  | { kind: 'pdf' | 'image'; url: string }
  | { kind: 'text'; text: string }
  | null {
  const preview = resource.preview;
  if (!preview) return null;
  if (preview.kind === 'text')
    return resource.mimeType === 'text/plain'
      ? { kind: 'text', text: preview.text }
      : null;
  if (preview.kind === 'pdf' && resource.mimeType !== 'application/pdf')
    return null;
  if (
    preview.kind === 'image' &&
    !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
      resource.mimeType,
    )
  )
    return null;
  const url = resolveResourceTarget(preview.targetId, config);
  return url ? { kind: preview.kind, url } : null;
}
export function filterResources(
  resources: readonly Resource[],
  query: string,
  category: ResourceCategory | 'all',
) {
  const search = query.trim().toLocaleLowerCase();
  return resources.filter(
    (resource) =>
      (category === 'all' || resource.category === category) &&
      `${resource.title} ${resource.description} ${resource.program || ''}`
        .toLocaleLowerCase()
        .includes(search),
  );
}
