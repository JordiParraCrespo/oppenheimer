import type { BotToolStep } from '@oppenheimer/frontend-consumer';

/**
 * How the chat words a bot's tool calls (`25-bots.md` §3): the chat is what
 * the bot says, so its work reads as one quiet line per run of calls in
 * plain verbs ("Searched the web for “bun vs node” · Updated its plan"),
 * never as the tools' own names. The words are the caller's (`t()`); this
 * says which phrase each call is and what it was pointed at.
 */

/** What one call did, as the chat says it. */
export type ToolAction =
  /** A web search, run by the provider; `query` is what it searched for. */
  | { kind: 'search'; query: string | undefined }
  /** The bot's to-do list, written again. */
  | { kind: 'plan' }
  /** Any other tool, by its name in words ("Read document"). */
  | { kind: 'tool'; label: string };

/** One phrase of a run's line: an action and how many calls in a row it covers. */
export type ActivityPhrase = ToolAction & { count: number };

/** The provider-run web search, as each engine names it. */
const SEARCH_TOOLS = new Set(['websearch', 'web_search', 'web_search_preview']);
/** The to-do list Claude Code keeps for the bot. */
const PLAN_TOOLS = new Set(['todowrite', 'todo_write']);
/** How an MCP tool's name reaches the chat: `mcp__<server>__<tool>`. */
const MCP_PREFIX = /^mcp__[^_]+(?:_[^_]+)*__/;

/**
 * A tool's name as words: the MCP prefix dropped, `snake_case`, `kebab-case`
 * and `camelCase` split, the first word capitalised ("read_document" and
 * "readDocument" are "Read document").
 */
export function humaniseToolName(name: string): string {
  const words = name
    .replace(MCP_PREFIX, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((word) => (/^[A-Z0-9]+$/.test(word) && word.length > 1 ? word : word.toLowerCase()));
  const sentence = words.join(' ');
  return sentence ? sentence.charAt(0).toUpperCase() + sentence.slice(1) : name;
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** What a call did, read from its tool's name and its input. */
export function toolAction(step: Pick<BotToolStep, 'name' | 'input'>): ToolAction {
  const key = step.name.replace(MCP_PREFIX, '').toLowerCase();
  if (SEARCH_TOOLS.has(key)) {
    const query = textOf(step.input.query);
    return { kind: 'search', query: query === undefined ? undefined : oneLine(query) };
  }
  if (PLAN_TOOLS.has(key)) return { kind: 'plan' };
  return { kind: 'tool', label: humaniseToolName(step.name) };
}

function sameAction(a: ToolAction, b: ToolAction): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'tool' || (b.kind === 'tool' && a.label === b.label);
}

/**
 * A run of calls as the phrases of its line, in the order they were made:
 * calls in a row that did the same thing are one phrase with their count
 * (three searches are "Searched the web 3 times"), and one search keeps its
 * query.
 */
export function activityPhrases(
  steps: readonly Pick<BotToolStep, 'name' | 'input'>[],
): ActivityPhrase[] {
  const phrases: ActivityPhrase[] = [];
  for (const step of steps) {
    const action = toolAction(step);
    const last = phrases.at(-1);
    if (last && sameAction(last, action)) {
      last.count += 1;
      if (last.kind === 'search') last.query = undefined;
      continue;
    }
    phrases.push({ ...action, count: 1 });
  }
  return phrases;
}

/** The call still running in a run, if one is: it has no output yet. */
export function runningStep<T extends Pick<BotToolStep, 'output'>>(
  steps: readonly T[],
): T | undefined {
  return [...steps].reverse().find((step) => step.output === null);
}

const TARGET_MAX = 80;

/** A text's first line, cut short. */
function oneLine(text: string): string {
  const line = text.split('\n')[0] ?? '';
  return line.length > TARGET_MAX ? `${line.slice(0, TARGET_MAX)}…` : line;
}

/**
 * What a call was pointed at, in one line: the first text it was given
 * (a query, a path, a command), cut short.
 */
export function toolTarget(input: Record<string, unknown>): string | undefined {
  const first = Object.values(input).map(textOf).find(Boolean);
  return first === undefined ? undefined : oneLine(first);
}

/** One item of the bot's to-do list, as a plan call wrote it. */
export interface PlanItem {
  text: string;
  state: 'pending' | 'active' | 'done';
}

/** The to-do list a plan call wrote, for its row's fold; empty when the input holds none. */
export function planItems(input: Record<string, unknown>): PlanItem[] {
  const todos = Array.isArray(input.todos) ? input.todos : [];
  return todos.flatMap((todo): PlanItem[] => {
    if (typeof todo !== 'object' || todo === null) return [];
    const row = todo as Record<string, unknown>;
    const text = textOf(row.content);
    if (!text) return [];
    const state =
      row.status === 'completed' ? 'done' : row.status === 'in_progress' ? 'active' : 'pending';
    return [{ text, state }];
  });
}
