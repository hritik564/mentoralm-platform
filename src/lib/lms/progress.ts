export interface OutlineItem {
  id: string;
  title: string;
  type: string;
  required: boolean;
  lesson: { format: string } | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
}
export interface OutlineSection {
  title: string;
  position: number;
  items: OutlineItem[];
}
export function lessonProgress(items: readonly OutlineItem[]) {
  const required = items.filter(
    (item) => item.type === 'LESSON' && item.lesson && item.required,
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
/** L2 contributor only. Future assessments/submissions must supply their own completion facts. */
export function learningProjection(sections: OutlineSection[]) {
  const lessons = sections
    .flatMap((section) => section.items)
    .filter((item) => item.type === 'LESSON' && item.lesson);
  const accessed =
    [...lessons]
      .filter((item) => item.lastAccessedAt)
      .sort(
        (a, b) =>
          b.lastAccessedAt!.localeCompare(a.lastAccessedAt!) ||
          a.id.localeCompare(b.id),
      )[0] || null;
  const next =
    accessed && !accessed.completedAt
      ? accessed
      : lessons.find((item) => item.required && !item.completedAt) ||
        lessons.find((item) => !item.completedAt) ||
        null;
  return {
    ...lessonProgress(lessons),
    lastAccessedAt: accessed?.lastAccessedAt || null,
    lastAccessedLesson: accessed
      ? { id: accessed.id, title: accessed.title }
      : null,
    nextLesson: next ? { id: next.id, title: next.title } : null,
  };
}
