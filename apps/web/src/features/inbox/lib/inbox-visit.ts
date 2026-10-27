import { inboxAnswered } from '@oppenheimer/frontend-consumer/react';

/**
 * What happened in the Inbox on this visit (`29-inbox.md` §5): the log above
 * the card, the items sent to the end with Later and what was marked done
 * (for Show done). The marks behind it are stored; this is the page's memory
 * only, kept outside React so the list and the pane, which share no parent
 * below the shell, read one visit. It is cleared when the reader leaves the
 * Inbox. What was answered and waits for its source to say so is the
 * product package's (`inboxAnswered`), so every count leaves it out too.
 */
export interface InboxLogEntry {
  id: number;
  text: string;
  at: Date;
}

export interface InboxVisit {
  log: readonly InboxLogEntry[];
  /** Keys sent to the end with Later, in the order they were sent. */
  later: readonly string[];
  /** Keys marked done this visit: Show done lists these. */
  done: readonly string[];
}

const EMPTY: InboxVisit = { log: [], later: [], done: [] };

let visit: InboxVisit = EMPTY;
let nextId = 1;
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
  log(text: string) {
    write({ ...visit, log: [...visit.log, { id: nextId++, text, at: new Date() }] });
  },
  later(key: string) {
    write({ ...visit, later: [...visit.later.filter((k) => k !== key), key] });
  },
  done(key: string) {
    write({ ...visit, done: [...visit.done.filter((k) => k !== key), key] });
  },
  forget(key: string) {
    write({ ...visit, done: visit.done.filter((k) => k !== key) });
  },
  /** Hidden from the list and every count until its source catches up. */
  answered(...keys: string[]) {
    inboxAnswered.add(...keys);
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
