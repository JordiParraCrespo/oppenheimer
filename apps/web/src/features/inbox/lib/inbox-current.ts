import { inboxSubject } from '@oppenheimer/frontend-consumer';
import type { InboxVisit } from './inbox-visit';

/**
 * The item in the pane: the one the address names while it is still in the
 * list, else the first. Clicking a row names it; answering or marking it
 * moves the pane on to whatever is first.
 *
 * An occurrence can also end without this visit settling it: an answer
 * refused because another tab answered first changes the session's wait, and
 * with it its key. The pane then stays with the same session or pull request
 * under its new key, so the refusal is read on the card it belongs to rather
 * than the pane jumping to another item and dropping it.
 */
export function currentItem<T extends { key: string }>(
  items: readonly T[],
  key: string | null,
  visit: Pick<InboxVisit, 'answered' | 'done'>,
): T | null {
  if (!key) return items[0] ?? null;
  const named = items.find((item) => item.key === key);
  if (named) return named;
  if (!visit.answered.includes(key) && !visit.done.includes(key)) {
    const subject = inboxSubject(key);
    const same = items.find((item) => inboxSubject(item.key) === subject);
    if (same) return same;
  }
  return items[0] ?? null;
}
