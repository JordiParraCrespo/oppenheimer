import { apiError } from './api-error';
import { cloudSessionIdPattern } from './cloud-id';
import { CLAUDE_ORIGIN } from './links';
import type { TrackedSession } from './session';
import type { OppenheimerConnection } from './store';

/**
 * A cloud session's chat, carried both ways between claude.ai and the person's
 * Oppenheimer console, the way the Claude apps see it:
 *
 * - **Out.** The session's event log, read from claude.ai with the sign-in
 *   already in this Chrome (the log the apps draw: every message, the
 *   person's included), is sent to `POST /api/v1/sessions/cloud-events`, each
 *   event as the transcript entry claude.ai keeps under its id. The console
 *   draws it with the chat it already has.
 * - **In.** A reply typed in the console is claimed from
 *   `POST /api/v1/sessions/cloud-replies/claim` and posted to the session on
 *   claude.ai as the person's message, which the session runs at once, mid-turn
 *   too; one claude.ai refuses is handed back for the session's Stop hook.
 *
 * Nothing of claude.ai's credentials leaves the browser: the reads and the
 * post ride on its cookies for claude.ai, and only the conversation goes to
 * the person's own API, with the token they gave it.
 */

/** One event of a session's log, as the API takes it. */
export interface ChatEvent {
  id: string;
  /** The transcript entry the event is, as JSON text. */
  line: string;
}

/** A reply the API handed over, to post on claude.ai. */
export interface ClaimedReply {
  id: string;
  cloudSessionId: string;
  text: string;
}

/** Events one request to the API carries (`MAX_CLOUD_TRANSCRIPT_BATCH`). */
export const EVENTS_BATCH = 200;
/**
 * The bytes of events one request carries, at most: well under the API's
 * 512 KB body limit, whatever the title and the JSON around them add.
 */
export const EVENTS_BATCH_BYTES = 400_000;
/** One event's line, at most (`MAX_CLOUD_TRANSCRIPT_LINE_BYTES`), as the session's hook cuts it. */
const MAX_LINE_BYTES = 64_000;
/** How long a string in a line too large may stay. */
const KEEP_CHARS = 4_000;
/** Pages of 1,000 events one read of a session's log goes through, at most. */
const MAX_EVENT_PAGES = 20;
/**
 * How long one attempt to post a reply on claude.ai may take. Both attempts
 * together stay well inside the claim's lease (`BROWSER_REPLY_LEASE_SECONDS`).
 */
export const POST_TIMEOUT_MS = 12_000;
/** The longest title the API keeps for a session it adopts (`MAX_CLOUD_SESSION_TITLE`). */
const MAX_TITLE = 200;

/**
 * Where a session's log is read, in the order tried: the endpoint the page
 * taught (claude.ai's own request for it, with `{id}` for the session), then
 * the two the Claude Code CLI reads it from.
 */
export function eventsUrls(sessionId: string, learned: string | null): string[] {
  const id = encodeURIComponent(sessionId);
  return [
    ...(learned ? [learned.replace('{id}', id)] : []),
    `${CLAUDE_ORIGIN}/v1/code/sessions/${id}/teleport-events?limit=1000&from_first_event=true`,
    `${CLAUDE_ORIGIN}/v1/sessions/${id}/events?limit=1000`,
  ];
}

/**
 * The events of one page of a session's log, oldest first, and where the next
 * page is; null for a body that is not a page of events. claude.ai answers
 * `{ data: [{ payload: <entry> }] , next_cursor }` on one route and the entries
 * themselves on another, so an event is its `payload` when it has one.
 */
export function eventsPage(
  body: unknown,
): { events: ChatEvent[]; next: string | null; newestFirst: boolean } | null {
  const record = asRecord(body);
  if (!record || !Array.isArray(record.data)) return null;
  const events = record.data.flatMap((raw): ChatEvent[] => {
    const outer = asRecord(raw);
    const entry = asRecord(outer?.payload) ?? outer;
    if (!entry || typeof entry.type !== 'string') return [];
    const id = [entry.uuid, outer?.uuid, outer?.event_id, outer?.id].find(
      (value): value is string =>
        typeof value === 'string' && value.length > 0 && value.length <= 128,
    );
    if (!id) return [];
    const line = fitLine(JSON.stringify(entry.uuid ? entry : { ...entry, uuid: id }));
    return line ? [{ id, line }] : [];
  });
  const next = [record.next_cursor, record.last_id].find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  const more = record.has_more !== false && Boolean(next);
  // A page sorted newest first is turned the right way up.
  const newestFirst = record.sort_order === 'desc';
  return {
    events: newestFirst ? events.reverse() : events,
    next: more ? (next ?? null) : null,
    newestFirst,
  };
}

/** Where a read of a session's log carries on: a page of a route, and how many events come before it. */
export interface LogPosition {
  url: string;
  cursor: string;
  offset: number;
}

/** What one read of a session's log got. */
export interface LogRead {
  /** Oldest first, starting at `offset` in the whole log. */
  events: ChatEvent[];
  offset: number;
  /** Read to the end of the log; false when the page cap or a failed page stopped it. */
  complete: boolean;
  /**
   * Where the next read starts: where this one stopped, or for a log read to
   * its end, its last page, which is where new events land. Null to start
   * from the first page again.
   */
  resume: LogPosition | null;
}

/**
 * Reads a session's log from claude.ai, page after page: from its first page
 * on the first route that answers, or from `from`, where an earlier read
 * stopped. Null when nothing answered. A read the page cap or a failed page
 * stopped says so (`complete: false`) and where to carry on, so a long log is
 * read a stretch at a time and never stuck re-reading its start.
 */
export async function fetchSessionEvents(
  sessionId: string,
  headers: Record<string, string>,
  learned: string | null,
  from: LogPosition | null = null,
): Promise<LogRead | null> {
  const starts = from
    ? [from]
    : eventsUrls(sessionId, learned).map((url) => ({ url, cursor: null, offset: 0 }));
  for (const start of starts) {
    const pageUrl = (cursor: string | null) => {
      if (!cursor) return start.url;
      const paged = new URL(start.url);
      paged.searchParams.delete('from_first_event');
      paged.searchParams.set('cursor', cursor);
      return paged.href;
    };
    const first = await readPage(pageUrl(start.cursor), headers);
    // A route that pages newest first ends on the oldest events: carrying on
    // from its last page would never reach a new one. Only a route that pages
    // oldest first is read; the next one is tried.
    if (!first || first.newestFirst || pagesNewestFirst(start.url)) continue;
    const events = [...first.events];
    let pageCursor = start.cursor;
    let pageOffset = start.offset;
    let next = first.next;
    let stoppedAt: LogPosition | null = null;
    for (let page = 1; next; page++) {
      const body = page < MAX_EVENT_PAGES ? await readPage(pageUrl(next), headers) : null;
      if (!body) {
        stoppedAt = { url: start.url, cursor: next, offset: start.offset + events.length };
        break;
      }
      pageCursor = next;
      pageOffset = start.offset + events.length;
      events.push(...body.events);
      next = body.next;
    }
    const lastPage = pageCursor ? { url: start.url, cursor: pageCursor, offset: pageOffset } : null;
    return {
      events: inTimeOrder(events),
      offset: start.offset,
      complete: stoppedAt === null,
      resume: stoppedAt ?? lastPage,
    };
  }
  return null;
}

/** Whether a route asks for its log newest first. */
export function pagesNewestFirst(url: string): boolean {
  const order =
    new URL(url).searchParams.get('sort_order') ?? new URL(url).searchParams.get('order');
  return order?.toLowerCase() === 'desc';
}

async function readPage(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { credentials: 'include', headers }).catch(() => null);
  return response?.ok ? eventsPage(await response.json().catch(() => null)) : null;
}

/**
 * Sends the events the API does not have yet (`events` past `sent`) in
 * batches it takes; answers how many it now has from this read, so the next
 * read sends only what is new. A batch the API refuses stops it there.
 */
export async function forwardEvents(
  connection: OppenheimerConnection,
  session: Pick<TrackedSession, 'id' | 'title'>,
  events: readonly ChatEvent[],
  sent: number,
): Promise<number> {
  if (!cloudSessionIdPattern.test(session.id)) return sent;
  let held = Math.min(sent, events.length);
  const title = cutTitle(session.title ?? '');
  while (held < events.length) {
    const batch = nextBatch(events, held);
    const response = await fetch(apiUrl(connection, '/api/v1/sessions/cloud-events'), {
      method: 'POST',
      headers: jsonHeaders(connection),
      body: JSON.stringify({
        cloudSessionId: session.id,
        title,
        events: batch,
      }),
    });
    if (!response.ok) throw await apiError(response);
    held += batch.length;
  }
  return held;
}

/**
 * The events from `from` that one request takes: at most `EVENTS_BATCH`, and
 * at most `EVENTS_BATCH_BYTES` of them, but always at least one (a line is
 * already cut to fit on its own).
 */
export function nextBatch(events: readonly ChatEvent[], from: number): ChatEvent[] {
  const batch: ChatEvent[] = [];
  let bytes = 0;
  for (const event of events.slice(from, from + EVENTS_BATCH)) {
    // Measured as it goes on the wire: the line is JSON inside JSON, escaped again.
    const size = byteLength(JSON.stringify(event)) + 1;
    if (batch.length > 0 && bytes + size > EVENTS_BATCH_BYTES) break;
    batch.push(event);
    bytes += size;
  }
  return batch;
}

/**
 * The title as the API takes it: at most `MAX_TITLE` UTF-16 units, the
 * measure its schema counts, cut between characters so no emoji is split;
 * none when it is blank.
 */
export function cutTitle(title: string): string | undefined {
  let cut = '';
  for (const character of title.trim()) {
    if (cut.length + character.length > MAX_TITLE) break;
    cut += character;
  }
  return cut.trim() || undefined;
}

/** The person's waiting replies, claimed for this extension, waiting up to `wait` seconds for one. */
export async function claimReplies(
  connection: OppenheimerConnection,
  wait: number,
  signal?: AbortSignal,
): Promise<ClaimedReply[]> {
  const response = await fetch(apiUrl(connection, '/api/v1/sessions/cloud-replies/claim'), {
    method: 'POST',
    headers: jsonHeaders(connection),
    body: JSON.stringify({ wait }),
    signal,
  });
  if (!response.ok) throw await apiError(response);
  const { replies } = (await response.json()) as { replies?: ClaimedReply[] };
  return Array.isArray(replies) ? replies : [];
}

/**
 * Tells the API claude.ai took a reply this extension claimed, so the claim
 * stops lapsing and nothing delivers the reply again.
 */
export async function confirmReply(
  connection: OppenheimerConnection,
  replyId: string,
): Promise<void> {
  const path = `/api/v1/sessions/cloud-replies/${encodeURIComponent(replyId)}/delivered`;
  const response = await fetch(apiUrl(connection, path), {
    method: 'POST',
    headers: jsonHeaders(connection),
  });
  if (!response.ok) throw await apiError(response);
  // `delivered: false` is an answer too: another way has it, nothing to tell again.
}

/** Gives a reply claude.ai refused back to the API, so the session's Stop hook can take it. */
export async function releaseReply(
  connection: OppenheimerConnection,
  replyId: string,
  reason: string,
): Promise<void> {
  const path = `/api/v1/sessions/cloud-replies/${encodeURIComponent(replyId)}/release`;
  const response = await fetch(apiUrl(connection, path), {
    method: 'POST',
    headers: jsonHeaders(connection),
    body: JSON.stringify({ reason: reason.slice(0, 64) }),
  });
  if (!response.ok) throw await apiError(response);
}

/**
 * Posts a reply on claude.ai as the person's next message in the session, the
 * call the Claude Code CLI makes for `claude --cloud`: a `user` event on the
 * session's log, with an id of its own so a repeat is one message. Tries the
 * session API, then the code-sessions route; says why when neither took it.
 */
export async function postReply(
  reply: ClaimedReply,
  headers: Record<string, string>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const event = {
    type: 'user',
    uuid: reply.id,
    parent_tool_use_id: null,
    message: { role: 'user', content: reply.text },
  };
  const id = encodeURIComponent(reply.cloudSessionId);
  const codeId = encodeURIComponent(reply.cloudSessionId.replace(/^session_/, 'cse_'));
  const attempts = [
    { url: `${CLAUDE_ORIGIN}/v1/sessions/${id}/events`, body: { events: [event] } },
    {
      url: `${CLAUDE_ORIGIN}/v1/code/sessions/${codeId}/events`,
      body: { events: [{ payload: event }] },
    },
  ];
  let reason = 'network';
  for (const attempt of attempts) {
    const response = await fetch(attempt.url, {
      method: 'POST',
      credentials: 'include',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(attempt.body),
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    }).catch(() => null);
    if (response?.ok) return { ok: true };
    if (response) reason = String(response.status);
  }
  return { ok: false, reason };
}

/**
 * The sessions whose log is read on this pass: the ones running or waiting on
 * the person, the ones a reply was just posted to (`hot`), and, once each,
 * every one active in the last day the API has not had yet. An older session
 * is left out until it moves. In the order to read them: replied-to first,
 * then the one read longest ago.
 */
export function sessionsToSync(
  sessions: readonly TrackedSession[],
  synced: Readonly<Record<string, ChatSync>>,
  hot: ReadonlySet<string>,
  now: number,
): TrackedSession[] {
  const day = 24 * 60 * 60_000;
  const due = sessions.filter((session) => {
    if (!cloudSessionIdPattern.test(session.id)) return false;
    if (hot.has(session.id)) return true;
    if (session.state === 'running' || session.state === 'needs-input') return true;
    const updated = session.updatedAt ? Date.parse(session.updatedAt) : Number.NaN;
    const recent = Number.isFinite(updated) && now - updated < day;
    const known = synced[session.id];
    // Changed since its last read, or never read at all.
    return recent && (!known || (session.updatedAt ?? '') > known.at);
  });
  // A pass reads a few: the ones replied to first, then the longest unread,
  // so a cap on a pass rotates through every session that is due.
  const order = (session: TrackedSession) =>
    `${hot.has(session.id) ? 0 : 1}${synced[session.id]?.readAt ?? ''}`;
  return due.sort((a, b) => order(a).localeCompare(order(b)));
}

/** How far a session's log has gone to the API: events sent, and the activity time read up to. */
export interface ChatSync {
  /** Events of the whole log the console has. */
  sent: number;
  /** The session's activity time its log was last read to the end at. */
  at: string;
  /** Where the next read starts; absent or null from the first page. */
  resume?: LogPosition | null;
  /** When it was last read, to read the longest-waiting first. */
  readAt?: string;
}

/**
 * A line the API takes: as it is when it fits, else with every long string
 * in it cut short (a tool's output, a file it read), as the session's hook
 * cuts it; null when even that does not fit.
 */
export function fitLine(line: string): string | null {
  if (byteLength(line) <= MAX_LINE_BYTES) return line;
  const cut = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const chars = Array.from(value);
      return chars.length > KEEP_CHARS
        ? `${chars.slice(0, KEEP_CHARS).join('')}… [cut short]`
        : value;
    }
    if (Array.isArray(value)) return value.map(cut);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, cut(inner)]));
    }
    return value;
  };
  const shorter = JSON.stringify(cut(JSON.parse(line)));
  return byteLength(shorter) <= MAX_LINE_BYTES ? shorter : null;
}

/**
 * The events oldest first by the time each entry carries, whatever order the
 * route paged them in; the order read is kept between equal times, and for a
 * log whose entries carry none. One event read twice is kept once.
 */
export function inTimeOrder(events: readonly ChatEvent[]): ChatEvent[] {
  const seen = new Set<string>();
  const unique = events.filter((event) => !seen.has(event.id) && seen.add(event.id));
  const times = unique.map((event) => {
    const at = (JSON.parse(event.line) as { timestamp?: unknown }).timestamp;
    return typeof at === 'string' ? Date.parse(at) : Number.NaN;
  });
  if (times.some((time) => !Number.isFinite(time))) return unique;
  return unique
    .map((event, index) => ({ event, index, time: times[index] }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ event }) => event);
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function apiUrl(connection: OppenheimerConnection, path: string): string {
  return new URL(path, new URL(connection.apiUrl).origin).href;
}

function jsonHeaders(connection: OppenheimerConnection): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
