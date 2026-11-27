import { type InboxItem, inboxSubject } from '@oppenheimer/frontend-consumer';

/**
 * The card the reader is working in, held on the deck: an unattended
 * session whose Reply here is open. Its item leaves the list the moment the
 * session goes back to work, which is what the reply is for; without the
 * hold the deck would go on to the next card under the reader's hands, focus
 * would fall to the page, and the keys still being typed would drive the
 * deck (a digit pressing the next card's Allow). Held, it stays until the
 * reader closes the reply, puts it away or moves on, as a bot's notice does.
 * One card at most: only the card on the deck holds.
 */
let held: InboxItem | null = null;
const listeners = new Set<() => void>();

function write(next: InboxItem | null) {
  if (held === next) return;
  held = next;
  for (const listener of listeners) listener();
}

export const inboxHeld = {
  get: (): InboxItem | null => held,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  hold(item: InboxItem) {
    write(item);
  },
  /** Lets go of `key`'s subject, if it is the one held. */
  release(key: string) {
    if (held && inboxSubject(held.key) === inboxSubject(key)) write(null);
  },
};

/**
 * The item on the deck once the hold is counted: the held one while the
 * address names it (or names nothing) and its subject has left the list;
 * otherwise what the list says. Moving on (J, K, a row) names another item,
 * which ends the hold's say.
 */
export function heldCurrent<T extends { key: string }>(
  open: readonly T[],
  named: string | null,
  current: T | null,
  hold: T | null,
): T | null {
  if (!hold) return current;
  const subject = inboxSubject(hold.key);
  if (named !== null && inboxSubject(named) !== subject) return current;
  if (open.some((item) => inboxSubject(item.key) === subject)) return current;
  return hold;
}
