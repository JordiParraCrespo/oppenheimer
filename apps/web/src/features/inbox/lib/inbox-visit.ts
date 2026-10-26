/**
 * What happened in the Inbox on this visit (`28-inbox.md` §5): the log above
 * the card, the items sent to the end with Later, what was marked done (for
 * Show done) and what was answered and is waiting for its source to say so.
 * The marks behind it are stored; this is the page's memory only, kept
 * outside React so the list and the pane, which share no parent below the
 * shell, read one visit. It is cleared when the reader leaves the Inbox.
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
  /** Keys answered this visit, hidden before their source catches up. */
  answered: readonly string[];
}

const EMPTY: InboxVisit = { log: [], later: [], done: [], answered: [] };

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
  answered(key: string) {
    write({ ...visit, answered: [...visit.answered, key] });
  },
  clear() {
    if (visit !== EMPTY) write(EMPTY);
  },
};

/**
 * The open items in the order this visit reads them: answered ones gone,
 * those sent to the end with Later after the rest, in the order sent.
 */
export function visitOrder<T extends { key: string }>(items: readonly T[], state: InboxVisit): T[] {
  const answered = new Set(state.answered);
  const later = new Map(state.later.map((key, index) => [key, index]));
  const kept = items.filter((item) => !answered.has(item.key));
  return [
    ...kept.filter((item) => !later.has(item.key)),
    ...kept
      .filter((item) => later.has(item.key))
      .sort((a, b) => (later.get(a.key) ?? 0) - (later.get(b.key) ?? 0)),
  ];
}
