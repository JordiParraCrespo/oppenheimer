import { INBOX_ITEM_KEY_MAX, INBOX_ITEM_KEY_PATTERN, type InboxMark } from '@oppenheimer/shared';

/** What is wrong with a mark as asked, or `null` when nothing is. */
export type InboxMarkProblem = 'item_key' | 'until_missing' | 'until_unexpected' | 'until_past';

/** Whether `key` is an occurrence's key: `<kind>:<id>`, in the characters a key may hold. */
export function isInboxItemKey(key: string): boolean {
  return key.length <= INBOX_ITEM_KEY_MAX && INBOX_ITEM_KEY_PATTERN.test(key);
}

/**
 * The rules a mark is held to (`product/versions/mvp/29-inbox.md` §3): a key
 * the table can hold, and an end with a snooze and only with one, later than
 * `now`. The first problem found, in that order.
 */
export function inboxMarkProblem(
  input: { itemKey: string; mark: InboxMark; until: Date | null },
  now: Date,
): InboxMarkProblem | null {
  if (!isInboxItemKey(input.itemKey)) return 'item_key';
  if (input.mark !== 'snoozed') return input.until ? 'until_unexpected' : null;
  if (!input.until) return 'until_missing';
  return input.until.getTime() > now.getTime() ? null : 'until_past';
}

/** Whether a stored mark still holds at `now`: a snooze whose end has passed no longer does. */
export function isInboxMarkInForce(mark: InboxMark, until: Date | null, now: Date): boolean {
  return mark !== 'snoozed' || (until !== null && until.getTime() > now.getTime());
}
