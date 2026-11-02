import type { BotMemoryFactEntity } from '@oppenheimer/frontend-consumer';

/**
 * How a fact's row reads in Settings → Memory, as keys under
 * `bots.settings.memory`: whether another of the person's bots shared it
 * (muted, read only), the tag it carries (about the person, or only looked
 * up; none for a fact in mind about the work), and its line (who wrote it).
 */
export interface FactRowModel {
  shared: boolean;
  kind: 'aboutYou' | 'lookedUp' | null;
  meta: 'sharedBy' | 'learned' | 'editedByYou' | 'addedByYou';
}

export function factRowModel(fact: BotMemoryFactEntity, botId: string): FactRowModel {
  const shared = fact.isSharedWith(botId);
  const kind = fact.scope === 'person' ? 'aboutYou' : fact.tier === 'log' ? 'lookedUp' : null;
  if (shared) return { shared, kind, meta: 'sharedBy' };
  if (fact.source === 'bot') return { shared, kind, meta: 'learned' };
  return { shared, kind, meta: fact.isEdited ? 'editedByYou' : 'addedByYou' };
}
