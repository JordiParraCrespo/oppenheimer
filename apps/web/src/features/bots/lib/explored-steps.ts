import type { BotToolStep } from '@oppenheimer/frontend-consumer';

/**
 * Which of a bot's calls only look around, so a run of them folds into one
 * "Explored" line that names what they read ("Read session, mail thread ·
 * Listed hosts · Searched mail “invoice”"), the way Codex folds its
 * exploring calls (`exec_cell/model.rs`) and the session chat folds reads.
 * A bot has no file tools, so its read-only calls are known by name: a
 * `read_`, `get_`, `list_` or `search_` tool, the web search and fetch, and
 * the few that only look (`peek`, `recall`, `run_history`). Any other call
 * ends the run.
 */

export type ExploreVerb = 'read' | 'list' | 'search';

/** How an MCP tool's name reaches the chat: `mcp__<server>__<tool>`. */
const MCP_PREFIX = /^mcp__[^_]+(?:_[^_]+)*__/;

const PREFIXES: [string, ExploreVerb][] = [
  ['read_', 'read'],
  ['get_', 'read'],
  ['list_', 'list'],
  ['search_', 'search'],
];

/**
 * Read-only tools whose name says no verb. The web search is named by what
 * it searched for and a fetch by the site it read; the rest by their name.
 */
const NAMED: Record<string, ExploreVerb> = {
  web_search: 'search',
  websearch: 'search',
  web_search_preview: 'search',
  web_fetch: 'read',
  webfetch: 'read',
  peek: 'read',
  recall: 'search',
  run_history: 'read',
};
const WEB_SEARCH = new Set(['web_search', 'websearch', 'web_search_preview']);
const WEB_FETCH = new Set(['web_fetch', 'webfetch']);

const QUERY_MAX = 40;

/** What a read-only call looked at; none for a call that may change something. */
export interface StepExplore {
  verb: ExploreVerb;
  /** What it read, in words off the tool's name ("session", "mail thread"); a site for a fetch, empty for the web search. */
  object: string;
  /** What a search searched for, cut short. */
  query?: string;
}

function queryOf(input: Record<string, unknown>): string | undefined {
  const value = input.query ?? input.q ?? input.pattern;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const line = value.trim().split('\n')[0] ?? '';
  return line.length > QUERY_MAX ? `${line.slice(0, QUERY_MAX)}…` : line;
}

/** The site a fetch read, or its address as it came. */
function siteOf(input: Record<string, unknown>): string {
  const url = typeof input.url === 'string' ? input.url : '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function stepExplore(step: Pick<BotToolStep, 'name' | 'input'>): StepExplore | null {
  const key = step.name.replace(MCP_PREFIX, '').toLowerCase();
  const named = NAMED[key];
  const prefixed = PREFIXES.find(([prefix]) => key.startsWith(prefix));
  const base = named
    ? {
        verb: named,
        object: WEB_SEARCH.has(key) ? '' : WEB_FETCH.has(key) ? siteOf(step.input) : key,
      }
    : prefixed
      ? { verb: prefixed[1], object: key.slice(prefixed[0].length) }
      : null;
  if (!base) return null;
  const object = base.object.replaceAll('_', ' ');
  const query = base.verb === 'search' ? queryOf(step.input) : undefined;
  return query === undefined ? { verb: base.verb, object } : { verb: base.verb, object, query };
}

/** A run of steps of one sort: all looking around, or all doing something else. */
export interface StepRun {
  explored: boolean;
  steps: BotToolStep[];
}

/** A turn's calls cut where they turn from looking around to doing something else and back. */
export function stepRuns(steps: readonly BotToolStep[]): StepRun[] {
  const runs: StepRun[] = [];
  for (const step of steps) {
    const explored = stepExplore(step) !== null;
    const previous = runs.at(-1);
    if (previous?.explored === explored) previous.steps.push(step);
    else runs.push({ explored, steps: [step] });
  }
  return runs;
}

/** One verb of an Explored line and what it names, each once. */
export interface ExploredPart {
  verb: ExploreVerb;
  targets: string[];
}

/**
 * What a run of read-only calls looked at, by verb in the order each first
 * came: the same thing read twice (two `get_session`s) named once, a search
 * by what it searched and for what (mail “invoice”).
 */
export function exploredParts(steps: readonly BotToolStep[]): ExploredPart[] {
  const parts = new Map<ExploreVerb, Set<string>>();
  for (const step of steps) {
    const explore = stepExplore(step);
    if (!explore) continue;
    const targets = parts.get(explore.verb) ?? new Set<string>();
    const target = [explore.object, explore.query ? `“${explore.query}”` : '']
      .filter(Boolean)
      .join(' ');
    if (target) targets.add(target);
    parts.set(explore.verb, targets);
  }
  return [...parts].map(([verb, targets]) => ({ verb, targets: [...targets] }));
}
