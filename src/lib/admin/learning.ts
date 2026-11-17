/** Presentation grouping of the existing, explicitly selected Batch session projection. */
export type SessionTime = { starts: string; ends: string };
export function learningSessionGroup(
  session: SessionTime,
  now: Date,
): 'Today' | 'Upcoming' | 'Past' {
  const starts = Date.parse(session.starts),
    ends = Date.parse(session.ends),
    today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`),
    tomorrow = today + 24 * 60 * 60 * 1000;
  if (starts < tomorrow && ends > today) return 'Today';
  return starts >= tomorrow ? 'Upcoming' : 'Past';
}
export function learningRecordingGroup(
  recording: { status: string; cleanupPending: boolean } | null,
): 'Needs Publishing' | 'Published' | 'Processing / Unavailable' {
  if (!recording || recording.cleanupPending) return 'Processing / Unavailable';
  if (recording.status === 'READY') return 'Needs Publishing';
  if (recording.status === 'PUBLISHED') return 'Published';
  return 'Processing / Unavailable';
}
