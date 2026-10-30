/**
 * Which new mail a watching routine takes (`product/next-steps/mail.md` §5):
 * its Gmail query, run by Gmail itself on recent mail, so a routine's
 * condition is written the way a search is.
 */

/** A watched query as it is asked of Gmail: only recent mail, where the new mail is. */
export function watchedQuery(query: string): string {
  return `(${query}) newer_than:2d`;
}

/** The watched queries whose answers name a message. */
export function matchedQueries(
  messageId: string,
  answers: ReadonlyMap<string, readonly string[]>,
): string[] {
  return [...answers].flatMap(([query, ids]) => (ids.includes(messageId) ? [query] : []));
}

/**
 * The new messages some trigger takes, each with the queries it matched: all
 * of them when a trigger watches for any mail, else those a query matched.
 */
export function takenMessages(
  messageIds: readonly string[],
  filters: readonly (string | null)[],
  answers: ReadonlyMap<string, readonly string[]>,
): { id: string; matched: string[] }[] {
  return messageIds
    .map((id) => ({ id, matched: matchedQueries(id, answers) }))
    .filter(({ matched }) => filters.includes(null) || matched.length > 0);
}
