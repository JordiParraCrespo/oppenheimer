/**
 * One meeting invited to two of a person's addresses comes back from both
 * accounts (`23-plan-milestones-stats-accounts.md` §5). It is one item on the
 * month, so the copies after the first are dropped.
 *
 * Two copies are the same when they share a key (`keyOf`): the event's `iCalUID`
 * and its occurrence (an instance of a recurring event by its
 * `originalStartTime`, anything else by its start), plus the day for an
 * all-day event drawn across several. The UID alone is not enough: every
 * instance of a recurring meeting shares it, so it would keep the first week
 * and drop the rest. The first copy wins, so pass the accounts in a stable
 * order.
 */
export function dropDuplicateEvents<T>(events: readonly T[], keyOf: (event: T) => string): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const event of events) {
    const key = keyOf(event);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(event);
  }
  return kept;
}
