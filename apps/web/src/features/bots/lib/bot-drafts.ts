import { type StoredTexts, storedTexts } from '@oppenheimer/frontend-web';

/**
 * What you are writing to each bot, kept while you are away from its chat
 * (the kit's `storedTexts`): a draft per bot, so moving to another bot or
 * reloading the page keeps a half-written message. Two places write it: the
 * composer as you type, and the hello's suggestions, which fill it and hand
 * focus to the composer. Each reader subscribes to the one bot it draws.
 */
export const botDrafts: StoredTexts = storedTexts('oppenheimer.bot-draft.');
const drafts = botDrafts;
const focusListeners = new Set<(botId: string) => void>();

/** The draft for a bot: what was last written, or what this browser kept. */
export function botDraft(botId: string): string {
  return drafts.read(botId);
}

/** Writes a bot's draft; an empty one is forgotten. */
export function setBotDraft(botId: string, text: string): void {
  drafts.write(botId, text);
}

/** Fills a bot's draft (a suggestion picked) and asks its composer to take focus. */
/**
 * Words that left the field come back to it, in front of anything written
 * since: a waiting message taken back (Edit), a send the API refused.
 */
export function returnToBotDraft(botId: string, words: string): void {
  const current = botDraft(botId);
  setBotDraft(botId, current ? `${words}\n${current}` : words);
}

export function fillBotDraft(botId: string, text: string): void {
  setBotDraft(botId, text);
  for (const listener of focusListeners) listener(botId);
}

/** Called with the bot's id whenever a fill asks its composer for focus; returns the unsubscribe. */
export function subscribeBotDraftFocus(listener: (botId: string) => void): () => void {
  focusListeners.add(listener);
  return () => focusListeners.delete(listener);
}
