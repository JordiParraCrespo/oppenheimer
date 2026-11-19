import {
  BOT_MEMORY_FACT_MAX,
  BOT_MEMORY_FACTS_MAX,
  type BotMemoryScope,
  type BotMemoryTier,
} from '@oppenheimer/shared';
import { promptText } from './bot-prompt-text.policy';

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
 * Which facts a turn keeps in mind, the way Grok Bot
 * does: the newest `profile`
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
export const MEMORY_CHOICE_RULE = promptText('tools/memory.which-memory');

/**
 * What `remember` tells the model: save as it goes,
 * without asking or checking for duplicates, and how the two choices it
 * makes keep a fact. Kept beside the policy that reads the tiers, so the
 * words and the rule change together.
 */
export const REMEMBER_DESCRIPTION = [
  promptText('tools/memory.remember-what-it-saves', {
    memoryFactMax: String(BOT_MEMORY_FACT_MAX),
  }),
  promptText('tools/memory.remember-as-you-go'),
  promptText('tools/memory.remember-learning-off'),
  MEMORY_CHOICE_RULE,
  promptText('tools/memory.remember-tiers', {
    memoryFactsMax: String(BOT_MEMORY_FACTS_MAX),
  }),
].join(' ');

export const REMEMBER_TIER_HINT = promptText('tools/memory.remember-tier-hint');

/** The tier `remember` keeps a fact in when the model names none. */
export const REMEMBER_DEFAULT_TIER: BotMemoryTier = 'log';

/** Which memory `remember` writes to, as the model names it. */
export const REMEMBER_MEMORY = ['yours', 'general'] as const;

export const REMEMBER_MEMORY_HINT = promptText('tools/memory.remember-memory-hint');

/** The memory a fact is in, by the name `remember` and the dream use for it. */
export function memoryNameOf(scope: BotMemoryScope): (typeof REMEMBER_MEMORY)[number] {
  return scope === 'person' ? 'general' : 'yours';
}

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
  const by = botId && fact.botId !== botId ? promptText('tools/memory.saved-by-another-bot') : '';
  return `general memory, ${tier}${by}`;
}
