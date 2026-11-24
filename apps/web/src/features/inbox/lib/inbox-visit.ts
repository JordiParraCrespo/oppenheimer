import { inboxAnswered } from '@oppenheimer/frontend-consumer/react';

/**
 * What happened in the Inbox on this visit: the items sent to the end with
 * Later, what was marked done (for Show done), how many were cleared (the
 * deck's progress), and which item follows the one in hand (where the deck
 * goes once that one leaves). The marks behind it are
 * stored; this is the page's memory only, kept outside React so the list and
 * the pane, which share no parent below the shell, read one visit. It is
 * cleared when the reader leaves the Inbox. What was answered and waits for
 * its source to say so is the product package's (`inboxAnswered`), so every
 * count leaves it out too.
 */
export interface InboxVisit {
  /** Keys sent to the end with Later, in the order they were sent. */
  later: readonly string[];
  /** Keys marked done this visit: Show done lists these. */
  done: readonly string[];
  /** Keys put away this visit, by any means: done, answered, snoozed or deleted. */
  cleared: readonly string[];
  /** The key after the item in hand, as the deck last drew it; null at the end. */
  next: string | null;
}

const EMPTY: InboxVisit = { later: [], done: [], cleared: [], next: null };

const add = (keys: readonly string[], key: string) => [...keys.filter((k) => k !== key), key];

let visit: InboxVisit = EMPTY;
const listeners = new Set<() => void>();

function write(next: InboxVisit) {
  visit = next;
  for (const listener of listeners) listener();
}

export const inboxVisit = {
  get: (): InboxVisit => visit,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  later(key: string) {
    write({ ...visit, later: add(visit.later, key) });
  },
  done(key: string) {
    write({ ...visit, done: add(visit.done, key), cleared: add(visit.cleared, key) });
  },
  /** Deleted: out of Show done, and cleared. */
  forget(key: string) {
    write({
      ...visit,
      done: visit.done.filter((k) => k !== key),
      cleared: add(visit.cleared, key),
    });
  },
  /** Snoozed, or put away some other way that leaves no row for this visit. */
  cleared(key: string) {
    write({ ...visit, cleared: add(visit.cleared, key) });
  },
  /**
   * Answered: hidden from the list and every count until its source catches
   * up, with any other wait the same answer settles (`alsoSettles`), and
   * cleared once.
   */
  answered(key: string, ...alsoSettles: string[]) {
    inboxAnswered.add(key, ...alsoSettles);
    write({ ...visit, cleared: add(visit.cleared, key) });
  },
  /** The deck's next item, kept only when it changes, so drawing it is no write. */
  follow(key: string | null) {
    if (visit.next !== key) write({ ...visit, next: key });
  },
  clear() {
    inboxAnswered.clear();
    if (visit !== EMPTY) write(EMPTY);
  },
};

/**
 * The open items in the order this visit reads them: those sent to the end
 * with Later after the rest, in the order sent.
 */
export function visitOrder<T extends { key: string }>(items: readonly T[], state: InboxVisit): T[] {
  const later = new Map(state.later.map((key, index) => [key, index]));
  return [
    ...items.filter((item) => !later.has(item.key)),
    ...items
      .filter((item) => later.has(item.key))
      .sort((a, b) => (later.get(a.key) ?? 0) - (later.get(b.key) ?? 0)),
  ];
}
