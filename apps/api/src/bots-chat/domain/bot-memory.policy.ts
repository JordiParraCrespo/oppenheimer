import {
  BOT_MEMORY_FACT_MAX,
  BOT_MEMORY_FACTS_MAX,
  type BotMemoryScope,
  type BotMemoryTier,
} from '@oppenheimer/shared';

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

/**
 * What `remember` tells the model (`25-bots.md` §4.1): when to save, and
 * how the two choices it makes keep a fact. Kept beside the policy that
 * reads the tiers, so the words and the rule change together.
 */
export const REMEMBER_DESCRIPTION = [
  `Saves one fact to your memory, in a sentence of at most ${BOT_MEMORY_FACT_MAX} characters, for every later conversation.`,
  'Only when "Learn automatically" is on in your settings; when it is off nothing is saved, and you ask the person in the chat first.',
  `Keep facts durable (preferences, names, decisions), one per call; you hold at most ${BOT_MEMORY_FACTS_MAX}, so forget one that no longer holds. Check recall first to avoid duplicates.`,
  'tier "profile" (the default) keeps it in mind in every turn: who the person is, how they like to work, standing rules. tier "log" keeps it to look up with recall: a detail, a past decision, something you will want only now and then.',
  'about "person" is for a fact about the person themselves (their name, their role, their preferences), which every bot of theirs then knows too; about "you" (the default) keeps it yours.',
].join(' ');

export const REMEMBER_TIER_HINT =
  '"profile" (default): in mind every turn. "log": looked up with recall.';

/** Who a fact is about, as the model says it: itself (`you`) or the person. */
export const REMEMBER_ABOUT = ['you', 'person'] as const;

export const REMEMBER_ABOUT_HINT =
  '"you" (default): yours alone. "person": about the person, shared by all their bots.';

/** The scope a fact is kept in, from what `remember` was told it is about. */
export function memoryScopeOf(about: (typeof REMEMBER_ABOUT)[number] | undefined): BotMemoryScope {
  return about === 'person' ? 'person' : 'bot';
}

/**
 * How a fact is kept, in a few words: in mind or to look up, yours or about
 * the person, and, read by `botId`, whether another of their bots keeps it.
 */
export function describeKept(
  fact: { tier: BotMemoryTier; scope: BotMemoryScope; botId: string },
  botId?: string,
): string {
  const tier = fact.tier === 'profile' ? 'in mind' : 'to look up';
  if (fact.scope === 'bot') return tier;
  const by = botId && fact.botId !== botId ? ', shared by another of their bots' : '';
  return `${tier}, about the person${by}`;
}
