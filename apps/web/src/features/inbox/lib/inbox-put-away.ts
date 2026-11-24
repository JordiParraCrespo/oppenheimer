import type { InboxItem } from '@oppenheimer/frontend-consumer';

/**
 * Whether Done can put the item away. Not while something waits on the
 * reader's answer, where Done would hide the card and leave the agent stuck:
 * a session whose agent is blocked (open, not failed or still starting) and a
 * bot stopped on an approval. Those leave the deck only by being answered.
 */
export function canPutAway(item: InboxItem): boolean {
  if (item.kind === 'approval') return false;
  if (item.kind === 'session') return item.session.lifecycle !== 'open';
  return true;
}
