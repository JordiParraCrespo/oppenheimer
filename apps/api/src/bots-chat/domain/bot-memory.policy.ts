import type { BotMemoryScope, BotMemoryTier } from '@oppenheimer/shared';

/** A fact as the prompt reads it. */
export interface RememberedFact {
  content: string;
  tier: BotMemoryTier;
  scope: BotMemoryScope;
}

/** What of a bot's memory a turn is given, and what it is only told it can look up. */
export interface MemoryInMind {
  /** Its own `profile` facts, oldest first. */
  own: string[];
  /** The `profile` facts about its owner, kept by any bot of theirs, oldest first. */
  person: string[];
  /** The facts left for `recall`: every `log` fact, and the `profile` facts past the cap. */
  toRecall: number;
}

/**
 * Which facts a turn keeps in mind (`25-bots.md` §4.1): the newest `max`
 * `profile` facts, the bot's own apart from those about its owner, which
 * every bot of theirs reads. The rest is counted, so the prompt can say
 * there is more to `recall`. `facts` comes newest first.
 */
export function memoryInMind(facts: readonly RememberedFact[], max: number): MemoryInMind {
  const profile = facts.filter((fact) => fact.tier === 'profile').slice(0, max);
  const inMind = [...profile].reverse();
  return {
    own: inMind.filter((fact) => fact.scope === 'bot').map((fact) => fact.content),
    person: inMind.filter((fact) => fact.scope === 'person').map((fact) => fact.content),
    toRecall: facts.length - profile.length,
  };
}
