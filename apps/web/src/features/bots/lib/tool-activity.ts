import type { BotMessageEntity, BotToolStep } from '@oppenheimer/frontend-consumer';

/**
 * How the chat words a bot's tool calls (`25-bots.md` §3, the Bots frame's
 * trace): a line per call in plain verbs ("Searched the web for “bun vs
 * node”", "Updated its plan"), never the tools' own names, and, while one
 * runs, what it is doing now ("Searching the web for …"). The words are the
 * caller's (`t()`); this says which kind of call each is and what it was
 * pointed at.
 */

/** What one call did, as the chat says it. */
export type ToolAction =
  /** A web search, run by the provider; `query` is what it searched for. */
  | { kind: 'search'; query: string | undefined }
  /** The bot's to-do list, written again. */
  | { kind: 'plan' }
  /** Subagents run in parallel (`delegate`); `tasks` is how many it handed out. */
  | { kind: 'delegate'; tasks: number }
  /** Any other tool, by its name in words ("Read document") and what it was given. */
  | { kind: 'tool'; label: string; target: string | undefined };

/** The provider-run web search, as each engine names it. */
const SEARCH_TOOLS = new Set(['websearch', 'web_search', 'web_search_preview']);
/** The to-do list Claude Code keeps for the bot. */
const PLAN_TOOLS = new Set(['todowrite', 'todo_write']);
/** How an MCP tool's name reaches the chat: `mcp__<server>__<tool>`. */
const MCP_PREFIX = /^mcp__[^_]+(?:_[^_]+)*__/;

const TARGET_MAX = 80;

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

/** What a call did, read from its tool's name and its input. */
export function toolAction(step: Pick<BotToolStep, 'name' | 'input'>): ToolAction {
  const key = step.name.replace(MCP_PREFIX, '').toLowerCase();
  if (SEARCH_TOOLS.has(key)) {
    const query = textOf(step.input.query);
    return { kind: 'search', query: query === undefined ? undefined : oneLine(query) };
  }
  if (PLAN_TOOLS.has(key)) return { kind: 'plan' };
  if (key === 'delegate') {
    return {
      kind: 'delegate',
      tasks: Array.isArray(step.input.tasks) ? step.input.tasks.length : 0,
    };
  }
  return { kind: 'tool', label: humaniseToolName(step.name), target: toolTarget(step.input) };
}

/**
 * The words over calls made together, by kind: a run of one kind says what
 * it did ("Searched the web 3 times"); a kind with no entry, or a mix, says
 * "Used 4 tools".
 */
const GROUP_SUMMARY = {
  search: 'bots.chat.activity.groupSearched',
} as const satisfies Partial<Record<ToolAction['kind'], string>>;

/** The one kind every call in a group shares; nothing for a mix or no calls. */
export function sharedKind(actions: readonly ToolAction[]): ToolAction['kind'] | undefined {
  const kinds = new Set(actions.map((action) => action.kind));
  return kinds.size === 1 ? [...kinds][0] : undefined;
}

/** The translation key for a group of calls' folded line; its `count` is the number of calls. */
export function groupSummary(
  actions: readonly ToolAction[],
): (typeof GROUP_SUMMARY)[keyof typeof GROUP_SUMMARY] | 'bots.chat.activity.group' {
  const kind = sharedKind(actions);
  return kind !== undefined && kind in GROUP_SUMMARY
    ? GROUP_SUMMARY[kind as keyof typeof GROUP_SUMMARY]
    : 'bots.chat.activity.group';
}

/**
 * What a running call is doing, as the turn's live line says it: the
 * translation key for its kind and what the words take ("Searching the web
 * for …", "Running 3 subagents", "Using Get session"). A new kind's words
 * are a case here.
 */
export function liveWords(action: ToolAction) {
  switch (action.kind) {
    case 'search':
      return action.query
        ? ({ key: 'bots.chat.activity.searchingFor', values: { query: action.query } } as const)
        : ({ key: 'bots.chat.activity.searching', values: {} } as const);
    case 'plan':
      return { key: 'bots.chat.activity.planning', values: {} } as const;
    case 'delegate':
      return { key: 'bots.chat.activity.delegating', values: { count: action.tasks } } as const;
    case 'tool':
      return { key: 'bots.chat.activity.using', values: { name: action.label } } as const;
  }
}

/** The call still running in a turn's work, if one is: the last with no output yet. */
export function runningStep(answer: readonly BotMessageEntity[]): BotToolStep | undefined {
  const steps = answer.flatMap((message) => (message.role === 'activity' ? message.steps : []));
  return [...steps].reverse().find((step) => step.output === null);
}

/** A call's output for reading: JSON indented, anything else as it came. */
export function readableOutput(output: string): string {
  const text = output.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return output;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return output;
  }
}

/** One item of the bot's to-do list, as a plan call wrote it. */
export interface PlanItem {
  text: string;
  state: 'pending' | 'active' | 'done';
}

/** The to-do list a plan call wrote, for its line's fold; empty when the input holds none. */
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
