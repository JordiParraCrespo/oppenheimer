/**
 * When the reader last saw each bot's chat, on this device: the bot's
 * `lastActivityAt` as it stood while its chat was open, so the time is the
 * API's and never this machine's clock. A bot with something newer that is
 * not working is done, and its sidebar row takes the blue dot, as a session
 * ready for review does. The marks are the reader's; the API never hears of
 * them.
 *
 * `since` is when this device started keeping them: a bot whose chat was
 * never opened here counts as seen then, so the first visit does not light
 * every bot that ever said something.
 */
const BOT_SEEN_KEY = 'oppenheimer.bots.seen';

interface Stored {
  since: number;
  seen: Record<string, number>;
}

function read(): Stored | null {
  try {
    const raw = window.localStorage.getItem(BOT_SEEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (typeof parsed.since !== 'number') return null;
    return { since: parsed.since, seen: parsed.seen ?? {} };
  } catch {
    return null;
  }
}

function write(stored: Stored): boolean {
  try {
    window.localStorage.setItem(BOT_SEEN_KEY, JSON.stringify(stored));
    return true;
  } catch {
    // Private browsing or a full quota: nothing is kept, and no bot reads as done.
    return false;
  }
}

/**
 * One store per page, so the chat that marks a bot seen and the sidebar row
 * that draws its dot read the same marks, whichever is mounted.
 */
const listeners = new Set<() => void>();
const notify = () => {
  for (const onChange of listeners) onChange();
};
// Another tab's write reaches this one only through the browser's storage event.
const fromOtherTab = (event: StorageEvent) => {
  if (event.key === BOT_SEEN_KEY || event.key === null) notify();
};

export const botSeen = {
  subscribe(onChange: () => void): () => void {
    if (read() === null && write({ since: Date.now(), seen: {} })) notify();
    if (listeners.size === 0) window.addEventListener('storage', fromOtherTab);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) window.removeEventListener('storage', fromOtherTab);
    };
  },
  /** When the bot was last seen, in ms; infinite until the device keeps marks, so nothing is done. */
  at(id: string): number {
    const stored = read();
    if (!stored) return Number.POSITIVE_INFINITY;
    return stored.seen[id] ?? stored.since;
  },
  mark(id: string, at: number): void {
    const stored = read() ?? { since: at, seen: {} };
    if ((stored.seen[id] ?? 0) >= at) return;
    if (write({ since: stored.since, seen: { ...stored.seen, [id]: at } })) notify();
  },
};

/**
 * Whether the bot has something the reader has not seen: it is not working,
 * it has said something, and its last message is newer than the reader's
 * last look at its chat.
 */
export function isBotDone(
  bot: { lastActivityAt: Date; lastMessagePreview: string | null },
  working: boolean,
  seenAt: number,
): boolean {
  if (working || bot.lastMessagePreview === null) return false;
  return bot.lastActivityAt.getTime() > seenAt;
}
