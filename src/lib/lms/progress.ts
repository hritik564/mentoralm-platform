import type { ItemCompletion } from './academic-rules';
export interface OutlineItem {
  id: string;
  title: string;
  type: string;
  required: boolean;
  inProgress?: boolean;
  completion?: ItemCompletion;
  lesson: { format: string } | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
}
export interface OutlineSection {
  title: string;
  position: number;
  items: OutlineItem[];
}
export function itemProgress(items: readonly OutlineItem[]) {
  const required = items.filter(
    (item) =>
      item.required &&
      (item.completion
        ? item.completion.eligible
        : item.type === 'LESSON' && !!item.lesson),
  );
  const completed = required.filter((item) => item.completedAt).length;
  return {
    requiredItems: required.length,
    completedItems: completed,
    percentage: required.length
      ? Math.round((completed / required.length) * 1000) / 10
      : null,
  };
}
/** Published configured contributors supply domain-owned completion facts; reads never mutate state. */
export function learningProjection(sections: OutlineSection[]) {
  const lessons = sections
    .flatMap((section) => section.items)
    .filter((item) =>
      item.completion
        ? item.completion.eligible
        : item.type === 'LESSON' && !!item.lesson,
    );
  const accessed =
    [...lessons]
      .filter((item) => item.lastAccessedAt)
      .sort(
        (a, b) =>
          b.lastAccessedAt!.localeCompare(a.lastAccessedAt!) ||
          a.id.localeCompare(b.id),
      )[0] || null;
  const next =
    accessed && (accessed.inProgress || !accessed.completedAt)
      ? accessed
      : lessons.find((item) => item.required && !item.completedAt) ||
        lessons.find((item) => !item.completedAt) ||
        null;
  return {
    ...itemProgress(lessons),
    lastAccessedAt: accessed?.lastAccessedAt || null,
    lastAccessedLesson:
      accessed?.type === 'LESSON'
        ? { id: accessed.id, title: accessed.title }
        : null,
    nextItem: next ? { id: next.id, title: next.title, type: next.type } : null,
    nextLesson:
      next?.type === 'LESSON' ? { id: next.id, title: next.title } : null,
  };
}

// Compatibility for existing Lesson-only consumers; there is one aggregator.
export const lessonProgress = itemProgress;
