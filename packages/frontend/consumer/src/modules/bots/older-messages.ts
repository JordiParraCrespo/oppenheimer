import type {
  BotConversationEntity,
  BotMessageEntity,
  BotTurnEntity,
} from './bot-conversation.entity';

/**
 * The history a reader scrolled up into: the pages of a bot's chat older than
 * the window its live read holds, oldest first, read one at a time as the top
 * of the chat comes into view. The live read keeps the newest messages and
 * moves on as the bot writes; these stay, and are laid under it
 * ({@link withOlderMessages}).
 */
export interface BotOlderMessages {
  messages: readonly BotMessageEntity[];
  /** The turns those messages belong to that had ended when read; a working one is the window's. */
  turns: readonly BotTurnEntity[];
  /** The chat holds messages older still. */
  hasOlder: boolean;
  /** The window's oldest message when these were joined to it: they end just before it. */
  boundary: { id: string; at: Date };
}

/**
 * Whether `older` ends where `window` begins: the window still holds the
 * message they end before, or starts earlier than it. A time the same as the
 * boundary's is not enough: the API orders within a millisecond by more than
 * this side can see, and the message beside the boundary would be left out.
 */
function joinsWindow(window: BotConversationEntity, older: BotOlderMessages): boolean {
  const first = window.messages[0];
  if (!first) return false;
  return (
    first.createdAt.getTime() < older.boundary.at.getTime() ||
    window.messages.some((message) => message.id === older.boundary.id)
  );
}

/**
 * The chat as the transcript draws it: the older pages read so far under the
 * live window, each message once, and whether more remain. Older pages that
 * no longer join the window stay drawn while the messages between are read
 * ({@link fillOlderGap}): they land below the line the reader is on, where
 * taking the pages away would have moved the chat to its end. A window that
 * holds the chat from its start (a chat just cleared) needs none.
 */
export function withOlderMessages(
  window: BotConversationEntity,
  older: BotOlderMessages | null | undefined,
): BotConversationEntity {
  if (!older || !window.hasOlder) return window;
  const inWindow = new Set(window.messages.map((message) => message.id));
  const windowTurns = new Set(window.turns.map((turn) => turn.id));
  const laidUnder = older.messages.filter((message) => !inWindow.has(message.id));
  return window.withLines(
    [...laidUnder, ...window.messages],
    [...older.turns.filter((turn) => !windowTurns.has(turn.id)), ...window.turns],
    window.messageCount,
    older.hasOlder,
    laidUnder.length + window.windowStart,
  );
}

/**
 * The message the next older page ends before: the oldest one the reader
 * holds; `null` when the chat holds nothing older.
 */
export function olderCursor(
  window: BotConversationEntity,
  older: BotOlderMessages | null | undefined,
): string | null {
  const shown = withOlderMessages(window, older);
  if (!shown.hasOlder) return null;
  return shown.messages[0]?.id ?? null;
}

type Lines = Pick<BotOlderMessages, 'messages' | 'turns'>;

/** A page's lines as older pages keep them: its turns that had ended, the ones its messages belong to. */
function linesOf(page: BotConversationEntity): Lines {
  const named = new Set(page.messages.flatMap((message) => message.turnId ?? []));
  return {
    messages: page.messages,
    turns: page.turns.filter((turn) => named.has(turn.id) && !turn.isActive),
  };
}

/** `earlier` laid under `later`, each message and turn once. */
function joined(later: Lines, earlier: Lines): Lines {
  const messages = new Set(later.messages.map((message) => message.id));
  const turns = new Set(later.turns.map((turn) => turn.id));
  return {
    messages: [
      ...earlier.messages.filter((message) => !messages.has(message.id)),
      ...later.messages,
    ],
    turns: [...earlier.turns.filter((turn) => !turns.has(turn.id)), ...later.turns],
  };
}

/**
 * `older` with `page` laid under it: the page read before
 * {@link olderCursor} of this `window`, or the first older pages, joined to
 * the window. Pages that no longer join it keep their place: the messages
 * between are read by whoever found the gap.
 */
export function addOlderPage(
  window: BotConversationEntity,
  older: BotOlderMessages | null | undefined,
  page: BotConversationEntity,
): BotOlderMessages | null {
  const first = window.messages[0];
  if (!first) return null;
  if (older) {
    return { ...older, ...joined(older, linesOf(page)), hasOlder: page.hasOlder };
  }
  return {
    ...linesOf(page),
    hasOlder: page.hasOlder,
    boundary: { id: first.id, at: first.createdAt },
  };
}

/**
 * `older` kept joined to `next`, a newer read of the window than `previous`:
 * the messages the window let go as the bot wrote (they are in `previous`,
 * before `next`'s first) move into the older pages, with nothing read again.
 * `'gap'` when `next` moved past all of `previous`, so the messages between
 * are in neither ({@link fillOlderGap}).
 */
export function slideOlder(
  older: BotOlderMessages,
  previous: BotConversationEntity | undefined,
  next: BotConversationEntity,
): BotOlderMessages | 'gap' {
  const first = next.messages[0];
  if (!first || joinsWindow(next, older)) return older;
  if (!previous) return 'gap';
  const from = previous.messages.findIndex((message) => message.id === older.boundary.id);
  const to = previous.messages.findIndex((message) => message.id === first.id);
  if (from === -1 || to === -1) return 'gap';
  const slid = previous.withLines(previous.messages.slice(from, to), previous.turns, 0);
  return {
    ...joined(linesOf(slid), older),
    hasOlder: older.hasOlder,
    boundary: { id: first.id, at: first.createdAt },
  };
}

/** How many pages a gap is read across before the older pages are let go instead. */
const GAP_PAGES_MAX = 5;

/**
 * The messages between a `window` that moved past the older pages and those
 * pages (the bot wrote a window's worth while the reader was up in its
 * history): read a page at a time, newest first, until one reaches the older
 * pages. `null` when the gap is wider than `GAP_PAGES_MAX` pages, or the older
 * pages are no longer in the chat. A read that fails throws.
 */
async function readBetween(
  window: BotConversationEntity,
  older: BotOlderMessages,
  readBefore: (messageId: string) => Promise<BotConversationEntity>,
): Promise<Lines | null> {
  const first = window.messages[0];
  if (!first) return null;
  let between: Lines = { messages: [], turns: [] };
  let cursor = first.id;
  for (let read = 0; read < GAP_PAGES_MAX; read += 1) {
    const page = await readBefore(cursor);
    between = joined(between, linesOf(page));
    if (joinsWindow(page, older)) return between;
    const oldest = page.messages[0];
    if (!page.hasOlder || !oldest) return null;
    cursor = oldest.id;
  }
  return null;
}

/**
 * The older pages joined again to a `window` that moved past them, the
 * messages between read and laid under the window ({@link readBetween}).
 * `null` when they cannot be joined.
 */
export async function fillOlderGap(
  window: BotConversationEntity,
  older: BotOlderMessages,
  readBefore: (messageId: string) => Promise<BotConversationEntity>,
): Promise<BotOlderMessages | null> {
  const first = window.messages[0];
  const between = await readBetween(window, older, readBefore);
  if (!first || !between) return null;
  return {
    ...joined(between, older),
    hasOlder: older.hasOlder,
    boundary: { id: first.id, at: first.createdAt },
  };
}

/**
 * A `window` that moved past the older pages, reaching back to them again:
 * the messages between are read before the window is drawn, so it never
 * shows with a hole where the reader may be. `null` when they cannot be
 * joined; the older pages are then let go. A read that fails throws.
 */
export async function windowReachingOlder(
  window: BotConversationEntity,
  older: BotOlderMessages,
  readBefore: (messageId: string) => Promise<BotConversationEntity>,
): Promise<BotConversationEntity | null> {
  const between = await readBetween(window, older, readBefore);
  if (!between) return null;
  const inWindow = new Set(window.messages.map((message) => message.id));
  const windowTurns = new Set(window.turns.map((turn) => turn.id));
  const reachedBack = between.messages.filter((message) => !inWindow.has(message.id));
  // What it reached back over is older history, not the live window.
  return window.withLines(
    [...reachedBack, ...window.messages],
    [...between.turns.filter((turn) => !windowTurns.has(turn.id)), ...window.turns],
    window.messageCount,
    window.hasOlder,
    reachedBack.length,
  );
}

/** The older pages with `emoji` as your reaction to message `messageId`, or none. */
export function olderWithReaction(
  older: BotOlderMessages | null | undefined,
  messageId: string,
  emoji: string | null,
): BotOlderMessages | null | undefined {
  if (!older?.messages.some((message) => message.id === messageId)) return older;
  return {
    ...older,
    messages: older.messages.map((message) =>
      message.id === messageId ? message.withReaction(emoji) : message,
    ),
  };
}
