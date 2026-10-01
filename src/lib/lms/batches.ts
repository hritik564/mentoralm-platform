export interface LmsBatch {
  name: string;
  code: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  membershipStatus: 'ACTIVE' | 'INACTIVE';
  startsAt: string | null;
  endsAt: string | null;
  scope: string | null;
  instructors: number;
}
/** Current delivery: active membership + active batch + inclusive UTC dates. Latest start wins, then code. */
export function currentBatch(
  batches: readonly LmsBatch[],
  now = new Date(),
): LmsBatch | null {
  return (
    batches
      .filter(
        (batch) =>
          batch.membershipStatus === 'ACTIVE' &&
          batch.status === 'ACTIVE' &&
          (!batch.startsAt || Date.parse(batch.startsAt) <= now.getTime()) &&
          (!batch.endsAt || Date.parse(batch.endsAt) >= now.getTime()),
      )
      .sort(
        (a, b) =>
          (b.startsAt ? Date.parse(b.startsAt) : -Infinity) -
            (a.startsAt ? Date.parse(a.startsAt) : -Infinity) ||
          a.code.localeCompare(b.code),
      )[0] || null
  );
}
