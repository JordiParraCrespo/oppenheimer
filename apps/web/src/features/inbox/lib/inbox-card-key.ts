import type { InboxItem } from '@oppenheimer/frontend-consumer';

/**
 * What the deck and the card in hand are keyed by: the item, so the next one
 * rises in fresh, with no drag, tilt or answer state left on it. A session is
 * keyed by the session instead, so a refused answer's error stays over the
 * decision it now waits on; a bot's notice by the bot, so a new notice from a
 * bot you are answering in place (a notice is the bot's latest, under a new
 * id) leaves its chat open and your draft focused.
 */
export function inboxCardKey(item: InboxItem): string {
  if (item.kind === 'session') return `session:${item.session.id}`;
  if (item.kind === 'botNotice') return `botNotice:${item.notice.botId}`;
  return item.key;
}
