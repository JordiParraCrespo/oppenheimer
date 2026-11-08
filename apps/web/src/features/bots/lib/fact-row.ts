import type { BotMemoryFactEntity } from '@oppenheimer/frontend-consumer';

/**
 * How a fact's row reads, as keys under `bots.settings.memory`: whether
 * another of the person's bots shared it (changed on that bot), the tag it
 * carries (about the person, or only looked up; none for a fact in mind about
 * the work), and its line (who wrote it).
 *
 * Read on a bot's page (`{ botId }`), or on the account's Settings → Memory
 * (`{ account: true }`), where every fact is about the reader and changed on
 * the bot that keeps it: never shared, no "about you" tag, and a line that
 * names that bot.
 */
export interface FactRowModel {
  shared: boolean;
  kind: 'aboutYou' | 'lookedUp' | null;
  meta:
    | 'sharedBy'
    | 'learned'
    | 'editedByYou'
    | 'addedByYou'
    | 'learnedBy'
    | 'editedByYouOn'
    | 'addedByYouOn';
}

export type FactRowPlace = { botId: string } | { account: true };

export function factRowModel(fact: BotMemoryFactEntity, place: FactRowPlace): FactRowModel {
  const onAccount = 'account' in place;
  const shared = !onAccount && fact.isSharedWith(place.botId);
  const kind =
    fact.scope === 'person' && !onAccount ? 'aboutYou' : fact.tier === 'log' ? 'lookedUp' : null;
  if (shared) return { shared, kind, meta: 'sharedBy' };
  if (fact.source === 'bot') return { shared, kind, meta: onAccount ? 'learnedBy' : 'learned' };
  if (fact.isEdited) return { shared, kind, meta: onAccount ? 'editedByYouOn' : 'editedByYou' };
  return { shared, kind, meta: onAccount ? 'addedByYouOn' : 'addedByYou' };
}
