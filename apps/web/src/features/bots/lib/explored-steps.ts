import {
  type BotToolStep,
  classifyTool,
  cutRuns,
  type ExploredPart,
  type ExploreTarget,
  type ExploreVerb,
  exploredParts,
} from '@oppenheimer/frontend-consumer';

/**
 * Which of a bot's calls only look around, for the product package's fold
 * (`cutRuns`, `exploredParts`), and the runs its trace draws. A bot has no
 * file tools, so its read-only calls are known by name: a `read_`, `get_`,
 * `list_` or `search_` tool, the few that only look (`peek`, `recall`,
 * `run_history`), and a web call, which the shared `classifyTool` knows (a
 * search, or a fetch that opens a page). Any other call ends the run.
 */

/** How an MCP tool's name reaches the chat: `mcp__<server>__<tool>`. */
const MCP_PREFIX = /^mcp__[^_]+(?:_[^_]+)*__/;

const PREFIXES: [string, ExploreVerb][] = [
  ['read_', 'read'],
  ['get_', 'read'],
  ['list_', 'list'],
  ['search_', 'search'],
];

/**
 * Read-only tools of ours whose name says no verb, named by their name; our
 * `web_fetch`, which `classifyTool` does not take for a web call, by its site.
 */
const NAMED: Record<string, ExploreVerb> = {
  web_fetch: 'read',
  peek: 'read',
  recall: 'search',
  run_history: 'read',
};

const QUERY_MAX = 40;

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

/**
 * What a read-only call looked at, named by what it read in words off the
 * tool's name ("session", "mail thread"), a site for a fetch, and what a
 * search searched for (mail “invoice”); none for a call that may change
 * something. Two reads of one kind of thing are one name.
 */
export function stepExplore(step: Pick<BotToolStep, 'name' | 'input'>): ExploreTarget | null {
  const web = classifyTool(step.name, step.input, 'bot');
  const key = step.name.replace(MCP_PREFIX, '').toLowerCase();
  const named = NAMED[key];
  const prefixed = PREFIXES.find(([prefix]) => key.startsWith(prefix));
  const base =
    web.kind === 'web'
      ? web.opensPage
        ? { verb: 'read' as const, object: siteOf(step.input) }
        : { verb: 'search' as const, object: '' }
      : named
        ? { verb: named, object: key === 'web_fetch' ? siteOf(step.input) : key }
        : prefixed
          ? { verb: prefixed[1], object: key.slice(prefixed[0].length) }
          : null;
  if (!base) return null;
  const query = base.verb === 'search' ? queryOf(step.input) : undefined;
  const label = [base.object.replaceAll('_', ' '), query ? `“${query}”` : '']
    .filter(Boolean)
    .join(' ');
  return { verb: base.verb, key: label, label };
}

/**
 * A run of the bot's finished calls as its trace draws it: a stretch that
 * only looked around, with what it looked at and whether the call in flight
 * is one more read (`exploring`), or a stretch of the rest.
 */
export type TraceRun =
  | {
      kind: 'explored';
      key: string;
      steps: BotToolStep[];
      parts: ExploredPart[];
      exploring: boolean;
    }
  | { kind: 'tools'; key: string; steps: BotToolStep[] };

/**
 * The bot's calls as the runs its trace draws, each holding only the calls
 * that finished: a call still running is the turn's live line, not a trace
 * line, but while the turn is `live` a running read keeps its run Exploring.
 * A run with nothing finished yet is not drawn.
 */
export function traceRuns(steps: readonly BotToolStep[], live: boolean): TraceRun[] {
  return cutRuns(steps, (step) => stepExplore(step) !== null).flatMap((run): TraceRun[] => {
    const done = run.items.filter((step) => step.output !== null);
    const [first] = done;
    if (!first) return [];
    if (!run.explored) return [{ kind: 'tools', key: first.callId, steps: done }];
    return [
      {
        kind: 'explored',
        key: first.callId,
        steps: done,
        parts: exploredParts(done, (step) => {
          const target = stepExplore(step);
          return target ? [target] : null;
        }),
        exploring: live && done.length < run.items.length,
      },
    ];
  });
}
