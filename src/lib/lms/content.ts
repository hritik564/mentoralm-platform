import { z } from 'zod';
const text = z.string().min(1).max(12000);
const block = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('heading'),
      text,
      level: z.union([z.literal(2), z.literal(3)]),
    })
    .strict(),
  z.object({ type: z.literal('paragraph'), text }).strict(),
  z
    .object({
      type: z.literal('list'),
      items: z.array(text).min(1).max(50),
      ordered: z.boolean().optional(),
    })
    .strict(),
  z.object({ type: z.literal('callout'), text }).strict(),
  z.object({ type: z.literal('code'), text }).strict(),
  z.object({ type: z.literal('divider') }).strict(),
]);
export const structuredLesson = z
  .object({ version: z.literal(1), blocks: z.array(block).min(1).max(100) })
  .strict();
export type LessonContent = z.infer<typeof structuredLesson>;
export function safeLessonContent(value: unknown): LessonContent | null {
  if (JSON.stringify(value ?? null).length > 100000) return null;
  const parsed = structuredLesson.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export interface ExternalRegistry {
  links: Readonly<Record<string, string>>;
  origins: readonly string[];
}
export function externalRegistry(): ExternalRegistry {
  try {
    return {
      links: JSON.parse(process.env.LMS_EXTERNAL_LINKS || '{}'),
      origins: (process.env.LMS_EXTERNAL_ORIGINS || '')
        .split(',')
        .filter(Boolean),
    };
  } catch {
    return { links: {}, origins: [] };
  }
}
export function approvedExternalLink(
  id: string | null,
  registry = externalRegistry(),
): string | null {
  if (
    !id ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
    !Object.hasOwn(registry.links, id)
  )
    return null;
  const value = registry.links[id];
  if (typeof value !== 'string' || /[\\\s%?#]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      registry.origins.includes(url.origin) &&
      value === `${url.origin}${url.pathname}`
      ? value
      : null;
  } catch {
    return null;
  }
}
export const lessonMimes: Record<string, readonly string[]> = {
  VIDEO: ['video/mp4', 'video/webm'],
  PDF: ['application/pdf'],
  IMAGE: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
};
