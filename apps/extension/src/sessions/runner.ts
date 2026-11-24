import type { OppenheimerConnection } from './store';

/**
 * Sessions on the person's own hosts that wait on them, read from the
 * Oppenheimer API they connected, with the token they gave it. The same
 * occurrences the console's Inbox lists: a session waiting on you (its
 * agent asks a question or a permission, or it failed) and a notice an
 * agent sent, each keyed as the Inbox keys it, so one is told once and a
 * new wait on the same session is told again.
 */

/** The fields of a `GET /api/v1/sessions` row this reads; the rest are ignored. */
export interface RunnerSessionRow {
  id: string;
  name: string;
  state: string;
  lifecycle: string;
  observedSince: string | null;
  stateSeq: number;
  cloudSessionId: string | null;
  decision: { id: string } | null;
  notice: { id: string; text: string } | null;
}

/** One thing a runner session waits on the person for. */
export interface RunnerWait {
  key: string;
  sessionId: string;
  name: string;
  kind: 'waiting' | 'failed' | 'notice';
  /** The agent's words, for a notice. */
  text?: string;
}

/** How many pages one look reads, 100 sessions each. */
const MAX_PAGES = 5;

/** The API's list of the workspace's open sessions, from the origin the person connected. */
export function runnerSessionsUrl(connection: OppenheimerConnection, cursor: string | null) {
  const url = new URL('/api/v1/sessions', new URL(connection.apiUrl).origin);
  url.searchParams.set('resolved', 'false');
  url.searchParams.set('limit', '100');
  if (cursor) url.searchParams.set('cursor', cursor);
  return url.href;
}

/**
 * Where a session opens in the console: the URL the person gave, or one
 * worked out from the API's (`localhost:3001` serves the console on `:3000`,
 * `api.<domain>` on `app.<domain>`).
 */
export function sessionPageUrl(connection: OppenheimerConnection, sessionId: string) {
  return new URL(`/sessions/${encodeURIComponent(sessionId)}`, consoleOrigin(connection)).href;
}

export function consoleOrigin(connection: OppenheimerConnection): string {
  if (connection.consoleUrl) return new URL(connection.consoleUrl).origin;
  const api = new URL(connection.apiUrl);
  if (api.hostname === 'localhost' || api.hostname === '127.0.0.1') {
    if (api.port === '3001') api.port = '3000';
    return api.origin;
  }
  if (api.hostname.startsWith('api.')) api.hostname = `app.${api.hostname.slice(4)}`;
  return api.origin;
}

/** The rows of one page, or null when the body is not a session list. */
export function runnerSessionPage(
  body: unknown,
): { rows: RunnerSessionRow[]; nextCursor: string | null } | null {
  const page = body as { data?: unknown; meta?: { nextCursor?: unknown } } | null;
  if (!page || !Array.isArray(page.data)) return null;
  const rows = page.data.filter(isRow);
  const next = page.meta?.nextCursor;
  return { rows, nextCursor: typeof next === 'string' && next ? next : null };
}

function isRow(row: unknown): row is RunnerSessionRow {
  const candidate = row as Partial<RunnerSessionRow> | null;
  return typeof candidate?.id === 'string' && typeof candidate.state === 'string';
}

/**
 * What the rows wait on the person for. A cloud run is left out: the
 * extension already tracks it on claude.ai, and telling it twice is noise.
 */
export function runnerWaits(rows: readonly RunnerSessionRow[]): RunnerWait[] {
  const waits: RunnerWait[] = [];
  for (const row of rows) {
    if (row.cloudSessionId) continue;
    const name = row.name || row.id;
    if (row.state === 'waiting-on-you') {
      waits.push({
        key: waitKey(row),
        sessionId: row.id,
        name,
        kind: row.lifecycle === 'failed' ? 'failed' : 'waiting',
      });
    }
    if (row.notice) {
      waits.push({
        key: `notice:${row.id}:${row.notice.id}`,
        sessionId: row.id,
        name,
        kind: 'notice',
        text: row.notice.text,
      });
    }
  }
  return waits;
}

/** The Inbox's key for a session's wait (`sessionItemKey`): one per occurrence. */
function waitKey(row: RunnerSessionRow): string {
  if (row.decision) return `session:${row.id}:${row.decision.id}`;
  if (row.lifecycle === 'open' && row.observedSince) {
    return `session:${row.id}:${new Date(row.observedSince).toISOString()}`;
  }
  return `session:${row.id}:s${row.stateSeq}`;
}

/**
 * The waits `seen` has not had yet, and the keys to remember. The first look
 * (`seen` null) tells nothing, so connecting does not announce everything
 * already waiting.
 */
export function newWaits(
  seen: readonly string[] | null,
  waits: readonly RunnerWait[],
): { fresh: RunnerWait[]; seen: string[] } {
  const keys = waits.map((wait) => wait.key);
  if (seen === null) return { fresh: [], seen: keys };
  const known = new Set(seen);
  return { fresh: waits.filter((wait) => !known.has(wait.key)), seen: keys };
}

/** How many runner sessions wait on the person: the badge's share of them. */
export function waitingCount(waits: readonly RunnerWait[]): number {
  return new Set(waits.filter((wait) => wait.kind !== 'notice').map((wait) => wait.sessionId)).size;
}

/**
 * Reads the open sessions, page by page. Throws with what the API said, as
 * the report does.
 */
export async function fetchRunnerSessions(
  connection: OppenheimerConnection,
): Promise<RunnerSessionRow[]> {
  const rows: RunnerSessionRow[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetch(runnerSessionsUrl(connection, cursor), {
      headers: { Authorization: `Bearer ${connection.token}` },
    });
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as { title?: string } | null;
      throw new Error(`${response.status} ${problem?.title ?? response.statusText}`.trim());
    }
    const parsed = runnerSessionPage(await response.json());
    if (!parsed) throw new Error('not a session list');
    rows.push(...parsed.rows);
    cursor = parsed.nextCursor;
    if (!cursor) break;
  }
  return rows;
}
