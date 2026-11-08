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
  /** `person` when it is about the owner, which any bot of theirs may have saved. */
  scope: BotMemoryScope;
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
    log: log.map(({ content, createdAt, scope }) => ({ content, createdAt, scope })),
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
 * The two memories a bot writes to, and the one test that picks between
 * them. A bot keeps its own memory, which no other bot reads; the general
 * memory is about the person and every bot of theirs reads it, so a fact
 * filed there wrongly lands in the prompt of bots whose job it is not. The
 * test leans to the bot's own memory: a misfiled own fact costs one bot a
 * lookup, a misfiled general fact costs every bot its prompt.
 */
export const MEMORY_CHOICE_RULE = [
  'You write to one of two memories.',
  'Your memory (memory "yours", the default) is read by you alone: everything about your job and the work you do for the person, such as their projects, repositories, folders, hosts, accounts, schedules, how they want this kind of work done, and settings or tools that only your work touches.',
  'The general memory (memory "general") is read by every bot the person has, whatever its job: only who the person is and how they want to be treated by any bot, such as their name, what they do for a living and for whom, language, time zone, how to address them, and working preferences they state for all their work.',
  'Choose "general" when the person says it is for all their bots or all their work ("any bot", "everything", "always"), or when it is who they are; save it in their words, without what it means for your own job.',
  'Otherwise ask: would a bot with a completely different job need this fact? If not, or if you are unsure, use "yours". A fact that names one of the person\'s projects, repositories, folders, hosts, accounts or tools is "yours", even when it is a preference of theirs.',
].join(' ');

/**
 * What `remember` tells the model (`25-bots.md` §4.1): save as it goes,
 * without asking or checking for duplicates, and how the two choices it
 * makes keep a fact. Kept beside the policy that reads the tiers, so the
 * words and the rule change together.
 */
export const REMEMBER_DESCRIPTION = [
  `Saves one fact, in a sentence of at most ${BOT_MEMORY_FACT_MAX} characters, for every later conversation.`,
  'Save as you go, in the turn you learn it: a preference, a correction, a decision, a name, how the person likes work done, what you found out about their repositories, hosts and projects. Do not ask first and do not check recall for duplicates; when a fact you keep has changed, forget it and remember the new one.',
  'When "Learn automatically" is off in your settings, nothing is saved: ask the person in the chat instead.',
  MEMORY_CHOICE_RULE,
  `tier "log" (the default) is a dated entry: your newest entries are in your prompt every turn and the rest are looked up with recall; once you keep ${BOT_MEMORY_FACTS_MAX} facts, your oldest log entry makes room. tier "profile" is for standing instructions and who the person is (their name, role, time zone, rules they gave you), in mind every turn; keep it short.`,
].join(' ');

export const REMEMBER_TIER_HINT =
  '"log" (default): dated; the newest in mind, the rest looked up with recall. "profile": standing instructions and who the person is, in mind every turn.';

/** The tier `remember` keeps a fact in when the model names none. */
export const REMEMBER_DEFAULT_TIER: BotMemoryTier = 'log';

/** Which memory `remember` writes to, as the model names it. */
export const REMEMBER_MEMORY = ['yours', 'general'] as const;

export const REMEMBER_MEMORY_HINT =
  '"yours" (default): your own memory, read by you alone; anything about your job and the work you do. "general": about the person, read by every bot of theirs; only facts a bot with a different job would also need.';

/** The scope a fact is kept in, from the memory `remember` was told to write to. */
export function memoryScopeOf(
  memory: (typeof REMEMBER_MEMORY)[number] | undefined,
): BotMemoryScope {
  return memory === 'general' ? 'person' : 'bot';
}

/**
 * How a fact is kept, in a few words: in the bot's own memory or the
 * general one, in mind or in the log, and, read by `botId`, whether another
 * of their bots saved it.
 */
export function describeKept(
  fact: { tier: BotMemoryTier; scope: BotMemoryScope; botId: string },
  botId?: string,
): string {
  const tier = fact.tier === 'profile' ? 'in mind' : 'in the log';
  if (fact.scope === 'bot') return `your memory, ${tier}`;
  const by = botId && fact.botId !== botId ? ', saved by another of their bots' : '';
  return `general memory, ${tier}${by}`;
}
