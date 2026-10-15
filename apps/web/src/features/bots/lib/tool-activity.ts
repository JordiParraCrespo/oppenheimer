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
  return { kind: 'tool', label: humaniseToolName(step.name), target: toolTarget(step.input) };
}

/** The call still running in a turn's work, if one is: the last with no output yet. */
export function runningStep(answer: readonly BotMessageEntity[]): BotToolStep | undefined {
  const steps = answer.flatMap((message) => (message.role === 'activity' ? message.steps : []));
  return [...steps].reverse().find((step) => step.output === null);
}

/** A page a web search found. */
export interface SearchResult {
  title: string;
  url: string;
}

const MAX_RESULTS = 8;
const JSON_STRING = '"((?:[^"\\\\]|\\\\.)*)"';
/** A title and its address in either order inside one object, as each provider's results print them. */
const RESULT_PATTERNS = [
  new RegExp(`"title"\\s*:\\s*${JSON_STRING}[^{}]*?"(?:url|link)"\\s*:\\s*${JSON_STRING}`, 'g'),
  new RegExp(`"(?:url|link)"\\s*:\\s*${JSON_STRING}[^{}]*?"title"\\s*:\\s*${JSON_STRING}`, 'g'),
];

function jsonText(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

/**
 * The pages a web search returned, read out of its output whatever shape the
 * provider printed it in (Claude's `Links: [...]`, z.ai's result summary):
 * every object with a title and a web address, the first of each address,
 * at most eight. Empty when the output names none.
 */
export function searchResults(output: string): SearchResult[] {
  const found = new Map<string, string>();
  RESULT_PATTERNS.forEach((pattern, index) => {
    for (const match of output.matchAll(pattern)) {
      const [first, second] = [jsonText(match[1] ?? ''), jsonText(match[2] ?? '')];
      const [title, url] = index === 0 ? [first, second] : [second, first];
      if (!/^https?:\/\//.test(url) || found.has(url)) continue;
      found.set(url, title.trim() || url);
    }
  });
  return [...found].slice(0, MAX_RESULTS).map(([url, title]) => ({ title, url }));
}

/** A call's output for reading: JSON indented, anything else as it came. */
export function readableOutput(output: string): string {
  const text = output.trim();
  if (!/^[[{]/.test(text)) return output;
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
