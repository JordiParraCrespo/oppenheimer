/**
 * What you are writing to each bot, kept while you are away from its chat:
 * a draft per bot, in memory and in this browser's storage, so moving to
 * another bot or reloading the page keeps a half-written message. Storage
 * is a convenience: when it is blocked (a private window, cleared site data)
 * the draft lives as long as the tab.
 *
 * A store outside React because two places write it: the composer as you
 * type, and the hello's suggestions, which fill it and hand focus to the
 * composer. Each reader subscribes to the one bot it draws.
 */

const STORAGE_PREFIX = 'oppenheimer.bot-draft.';

const drafts = new Map<string, string>();
const listeners = new Set<(botId: string) => void>();
const focusListeners = new Set<(botId: string) => void>();

function stored(botId: string): string {
  try {
    return globalThis.localStorage?.getItem(STORAGE_PREFIX + botId) ?? '';
  } catch {
    return '';
  }
}

function store(botId: string, text: string): void {
  try {
    if (text) globalThis.localStorage?.setItem(STORAGE_PREFIX + botId, text);
    else globalThis.localStorage?.removeItem(STORAGE_PREFIX + botId);
  } catch {
    // Blocked storage keeps the draft in memory only.
  }
}

/** The draft for a bot: what was last written, or what this browser kept. */
export function botDraft(botId: string): string {
  let text = drafts.get(botId);
  if (text === undefined) {
    text = stored(botId);
    drafts.set(botId, text);
  }
  return text;
}

/** Writes a bot's draft; an empty one is forgotten. */
export function setBotDraft(botId: string, text: string): void {
  if (botDraft(botId) === text) return;
  drafts.set(botId, text);
  store(botId, text);
  for (const listener of listeners) listener(botId);
}

/** Fills a bot's draft (a suggestion picked) and asks its composer to take focus. */
export function fillBotDraft(botId: string, text: string): void {
  setBotDraft(botId, text);
  for (const listener of focusListeners) listener(botId);
}

/** Called with the bot's id whenever any draft changes; returns the unsubscribe. */
export function subscribeBotDrafts(listener: (botId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called with the bot's id whenever a fill asks its composer for focus; returns the unsubscribe. */
export function subscribeBotDraftFocus(listener: (botId: string) => void): () => void {
  focusListeners.add(listener);
  return () => focusListeners.delete(listener);
}
