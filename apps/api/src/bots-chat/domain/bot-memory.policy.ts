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
  /** When it was saved: a `log` fact is shown under its day. */
  createdAt: Date;
}

/** How much of a bot's memory one turn carries, in characters of fact. */
export interface MemoryBudget {
  profileChars: number;
  logChars: number;
}

/** A `log` fact as a turn carries it, dated in the turn's own zone. */
export interface LogEntry {
  content: string;
  createdAt: Date;
}

/** What of a bot's memory a turn is given, and what it is only told it can look up. */
export interface MemoryInMind {
  /** Its own `profile` facts, oldest first. */
  own: string[];
  /** The `profile` facts about its owner, kept by any bot of theirs, oldest first. */
  person: string[];
  /** The newest `log` facts, oldest first. */
  log: LogEntry[];
  /** The facts left for `recall`: those past either budget. */
  toRecall: number;
}

/**
 * Which facts a turn keeps in mind (`25-bots.md` §4.1), the way Grok Bot
 * does (`research/lessons-from-grok-bot.md` §10): the newest `profile`
 * facts and the newest `log` facts, each tier up to a budget of characters,
 * so a long memory costs the prompt the same as a short one and its oldest
 * entries fade to `recall` rather than filling the turn. A tier stops at the
 * first fact past its budget, so what is in mind is always the newest run.
 * The profile goes in the system prompt; the log, which changes with every
 * save, and the count go in the turn context, so a save does not cost the
 * prompt cache. `facts` comes newest first.
 */
export function memoryInMind(facts: readonly RememberedFact[], budget: MemoryBudget): MemoryInMind {
  const profile = newestWithin(
    facts.filter((fact) => fact.tier === 'profile'),
    budget.profileChars,
  ).reverse();
  const log = newestWithin(
    facts.filter((fact) => fact.tier === 'log'),
    budget.logChars,
  ).reverse();
  return {
    own: profile.filter((fact) => fact.scope === 'bot').map((fact) => fact.content),
    person: profile.filter((fact) => fact.scope === 'person').map((fact) => fact.content),
    log: log.map(({ content, createdAt }) => ({ content, createdAt })),
    toRecall: facts.length - profile.length - log.length,
  };
}

function newestWithin(facts: readonly RememberedFact[], chars: number): RememberedFact[] {
  const kept: RememberedFact[] = [];
  let used = 0;
  for (const fact of facts) {
    used += fact.content.length;
    if (used > chars) break;
    kept.push(fact);
  }
  return kept;
}

/**
 * What `remember` tells the model (`25-bots.md` §4.1): save as it goes,
 * without asking or checking for duplicates, and how the two choices it
 * makes keep a fact. Kept beside the policy that reads the tiers, so the
 * words and the rule change together.
 */
export const REMEMBER_DESCRIPTION = [
  `Saves one fact to your memory, in a sentence of at most ${BOT_MEMORY_FACT_MAX} characters, for every later conversation.`,
  'Save as you go, in the turn you learn it: a preference, a correction, a decision, a name, how the person likes work done, what you found out about their repositories, hosts and projects. Do not ask first and do not check recall for duplicates; when a fact you keep has changed, forget it and remember the new one.',
  'When "Learn automatically" is off in your settings, nothing is saved: ask the person in the chat instead.',
  `tier "log" (the default) is a dated entry: your newest entries are in your prompt every turn and the rest are looked up with recall; once you keep ${BOT_MEMORY_FACTS_MAX} facts, your oldest log entry makes room. tier "profile" is for standing instructions and who the person is (their name, role, time zone, rules they gave you), in mind every turn; keep it short.`,
  'about "person" is for a fact about the person themselves (their name, their role, their preferences), which every bot of theirs then knows too; about "you" (the default) keeps it yours.',
].join(' ');

export const REMEMBER_TIER_HINT =
  '"log" (default): dated; the newest in mind, the rest looked up with recall. "profile": standing instructions and who the person is, in mind every turn.';

/** The tier `remember` keeps a fact in when the model names none. */
export const REMEMBER_DEFAULT_TIER: BotMemoryTier = 'log';

/** Who a fact is about, as the model says it: itself (`you`) or the person. */
export const REMEMBER_ABOUT = ['you', 'person'] as const;

export const REMEMBER_ABOUT_HINT =
  '"you" (default): yours alone. "person": about the person, shared by all their bots.';

/** The scope a fact is kept in, from what `remember` was told it is about. */
export function memoryScopeOf(about: (typeof REMEMBER_ABOUT)[number] | undefined): BotMemoryScope {
  return about === 'person' ? 'person' : 'bot';
}

/**
 * How a fact is kept, in a few words: in mind or in the log, yours or about
 * the person, and, read by `botId`, whether another of their bots keeps it.
 */
export function describeKept(
  fact: { tier: BotMemoryTier; scope: BotMemoryScope; botId: string },
  botId?: string,
): string {
  const tier = fact.tier === 'profile' ? 'in mind' : 'in the log';
  if (fact.scope === 'bot') return tier;
  const by = botId && fact.botId !== botId ? ', shared by another of their bots' : '';
  return `${tier}, about the person${by}`;
}
