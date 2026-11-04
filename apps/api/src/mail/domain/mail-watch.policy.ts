/**
 * Which new mail a watching routine takes (`product/next-steps/mail.md` §5):
 * its Gmail query, run by Gmail itself on recent mail, so a routine's
 * condition is written the way a search is.
 */

/** How long ago a message may have reached the account and still be new mail. */
export const NEW_MAIL_MAX_AGE_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A watched query as it is asked of Gmail: only recent mail, where the new mail is. */
export function watchedQuery(query: string): string {
  return `(${query}) newer_than:${NEW_MAIL_MAX_AGE_DAYS}d`;
}

/**
 * Whether a message Gmail received at `receivedAt` is still new mail at
 * `now`. However the history mark came to lag (a backlog, an outage),
 * mail older than this wakes nothing. One Gmail gives no time for is kept.
 */
export function isNewArrival(receivedAt: Date | null, now: Date): boolean {
  return (
    receivedAt === null || now.getTime() - receivedAt.getTime() <= NEW_MAIL_MAX_AGE_DAYS * DAY_MS
  );
}

/** The watched queries whose answers name a message. */
export function matchedQueries(
  messageId: string,
  answers: ReadonlyMap<string, readonly string[]>,
): string[] {
  return [...answers].flatMap(([query, ids]) => (ids.includes(messageId) ? [query] : []));
}

/**
 * The new messages some trigger takes, each with the queries it matched and
 * whether it reached the inbox: a trigger that watches for any mail takes
 * what arrived in the inbox, one with a query what its query matched. Which
 * triggers a message then fires is decided on those two facts
 * (`matchesTriggerFilter`), so mail a query took never wakes "any mail".
 */
export function takenMessages(
  mail: { messageIds: readonly string[]; inboxIds: readonly string[] },
  filters: readonly (string | null)[],
  answers: ReadonlyMap<string, readonly string[]>,
): { id: string; matched: string[]; inbox: boolean }[] {
  const anyMail = filters.includes(null);
  return mail.messageIds
    .map((id) => ({ id, matched: matchedQueries(id, answers), inbox: mail.inboxIds.includes(id) }))
    .filter(({ matched, inbox }) => matched.length > 0 || (anyMail && inbox));
}
