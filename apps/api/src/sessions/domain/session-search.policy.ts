import {
  AGENT_DECISION_EVENT_KIND,
  AGENT_NOTIFIED_EVENT_KIND,
  FILE_SHARED_EVENT_KIND,
  WAKE_REQUESTED_EVENT_KIND,
} from '@oppenheimer/shared';
import { SESSION_EVENT_KINDS } from './session-state.policy';
import { TURN_EVENT_KINDS } from './session-turn.policy';

/**
 * What a search across a workspace's sessions reads (`search_sessions`,
 * `product/versions/mvp/25-bots.md` §4.2): a session's name and the words of
 * its log, never ids, hashes or keys, and never the agent's transcript,
 * which stays on the host. Pure; the search itself is the repository's.
 */

/** The most sessions one search answers. */
export const SESSION_SEARCH_LIMIT_MAX = 20;

/**
 * How many matching entries one session shows at most, its best first, so
 * one session that said the word fifty times does not fill the page.
 */
export const SESSION_SEARCH_HITS_PER_SESSION = 2;

/** The hit a session's own name makes. Not a log kind: no entry has it. */
export const SESSION_NAME_HIT = 'session.name';

/** A path into a payload; `*` is each element of an array. */
type PayloadPath = readonly string[];

/**
 * Each searchable log kind and the payload fields whose words are searched.
 * The database's twin is `work_session_event_search_vector` (migration
 * `AddSessionSearch`), and the index is partial on these kinds: a kind added
 * here needs a migration that replaces both, which
 * `session-search.policy.spec.ts` holds.
 */
export const SESSION_SEARCH_FIELDS: Readonly<Record<string, readonly PayloadPath[]>> = {
  [SESSION_EVENT_KINDS.PROMPT_FIRST]: [['text']],
  [SESSION_EVENT_KINDS.PROMPT_SENT]: [['text']],
  [TURN_EVENT_KINDS.REQUESTED]: [['prompt']],
  [TURN_EVENT_KINDS.ENDED]: [['result']],
  [SESSION_EVENT_KINDS.FAILED]: [['detail']],
  [SESSION_EVENT_KINDS.NAMED]: [['name']],
  [AGENT_NOTIFIED_EVENT_KIND]: [['text']],
  [WAKE_REQUESTED_EVENT_KIND]: [['text']],
  [FILE_SHARED_EVENT_KIND]: [['name'], ['caption']],
  [SESSION_EVENT_KINDS.AGENT_OBSERVED]: [
    ['program', 'title'],
    ['program', 'message'],
  ],
  [AGENT_DECISION_EVENT_KIND]: [
    ['decision', 'title'],
    ['decision', 'detail'],
    ['decision', 'questions', '*', 'header'],
    ['decision', 'questions', '*', 'question'],
    ['decision', 'questions', '*', 'options', '*', 'label'],
    ['decision', 'questions', '*', 'options', '*', 'description'],
    ['decision', 'options', '*', 'label'],
  ],
};

/** The log kinds a search reads, in the order the index's predicate lists them. */
export const SESSION_SEARCH_KINDS: readonly string[] = Object.keys(SESSION_SEARCH_FIELDS);

/**
 * The words of one log entry as the search indexes them, joined by line:
 * the text a hit's snippet is cut from. Empty for a kind the search does not
 * read, or an entry whose fields hold no text.
 */
export function sessionSearchText(kind: string, payload: unknown): string {
  const paths = SESSION_SEARCH_FIELDS[kind];
  if (!paths) return '';
  return paths
    .flatMap((path) => stringsAt(payload, path))
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .join('\n');
}

/** One matching entry of a session, as it came back ranked. */
export interface SessionSearchRow<Hit> {
  sessionId: string;
  hit: Hit;
}

/**
 * Rows ranked best first, a session's best hit first among its own, as one
 * group per session in the order of each session's best hit: what the search
 * answers once the database has cut each session to its best few.
 */
export function groupSessionHits<Hit>(
  rows: readonly SessionSearchRow<Hit>[],
): { sessionId: string; hits: Hit[] }[] {
  const groups = new Map<string, Hit[]>();
  for (const row of rows) {
    const hits = groups.get(row.sessionId);
    if (hits) hits.push(row.hit);
    else groups.set(row.sessionId, [row.hit]);
  }
  return [...groups].map(([sessionId, hits]) => ({ sessionId, hits }));
}

/**
 * The strings at a path, as the database's lax `jsonb_path_query_array`
 * and `jsonb_to_tsvector(… '["string"]')` read them: a missing step is
 * nothing, and an array at the end gives its strings.
 */
function stringsAt(value: unknown, path: PayloadPath): string[] {
  if (path.length === 0) {
    if (typeof value === 'string') return [value];
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  }
  const [step, ...rest] = path;
  if (step === '*') {
    return Array.isArray(value) ? value.flatMap((item) => stringsAt(item, rest)) : [];
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  return stringsAt((value as Record<string, unknown>)[step], rest);
}
