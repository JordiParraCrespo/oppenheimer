/**
 * The bots the reader hid from the Employees sidebar, kept on this device
 * like the sessions sidebar's hidden projects: their ids. A hidden bot is not
 * drawn in its group unless a search names it. Hiding is the reader's, so the
 * API never hears of it, and the bot's chat and routines go on as before.
 */
export const HIDDEN_BOTS_KEY = 'oppenheimer.bots.hidden';

/** `hidden` with `id` hidden, or shown. */
export function withHiddenBot(hidden: readonly string[], id: string, shown: boolean): string[] {
  const rest = hidden.filter((hiddenId) => hiddenId !== id);
  return shown ? rest : [...rest, id];
}
