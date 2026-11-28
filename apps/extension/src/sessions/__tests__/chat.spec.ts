import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ChatEvent,
  cutTitle,
  EVENTS_BATCH,
  EVENTS_BATCH_BYTES,
  eventsPage,
  fetchSessionEvents,
  fitLine,
  forwardEvents,
  inTimeOrder,
  nextBatch,
  postReply,
  sessionsToSync,
} from '../chat';
import type { TrackedSession } from '../session';

/**
 * A cloud session's chat carried between claude.ai and the console: before,
 * the console had only what the session's hook sent, so a session started on
 * claude.ai or the phone showed nothing, and a reply typed in the console
 * waited for the agent's turn to end.
 */
const ID = 'session_014a8EH8DJs95X1iK8ZH9Y82';
const connection = { apiUrl: 'https://api.example.com', token: 't' };
const entry = (uuid: string, text: string, timestamp?: string) => ({
  type: 'user',
  uuid,
  ...(timestamp ? { timestamp } : {}),
  message: { role: 'user', content: text },
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('a page of a session’s log', () => {
  it('reads the entries inside `payload`, as the teleport route answers, and where the next page is', () => {
    const page = eventsPage({
      data: [
        { payload: entry('u1', 'Fix the login page') },
        { payload: { type: 'assistant', uuid: 'a1' } },
      ],
      next_cursor: 'c2',
    });
    expect(page?.events.map((event) => event.id)).toEqual(['u1', 'a1']);
    expect(JSON.parse(page?.events[0]?.line ?? '{}')).toMatchObject({ uuid: 'u1', type: 'user' });
    expect(page?.next).toBe('c2');
  });

  it('reads bare entries too, and names one without a uuid by the event’s own id', () => {
    // Breaks if the session API's shape, or an event claude.ai keyed apart
    // from its entry, is dropped and the console misses the turn.
    const page = eventsPage({
      data: [{ id: 'ev-9', type: 'system', subtype: 'init' }, entry('u2', 'hi')],
      has_more: false,
      last_id: 'u2',
    });
    expect(page?.events.map((event) => event.id)).toEqual(['ev-9', 'u2']);
    expect(JSON.parse(page?.events[0]?.line ?? '{}').uuid).toBe('ev-9');
    expect(page?.next).toBeNull();
  });

  it('is no page for a body that is not one', () => {
    expect(eventsPage({ sessions: [] })).toBeNull();
    expect(eventsPage(null)).toBeNull();
  });

  it('puts events back in time order, once each, whatever order a route paged them in', () => {
    const late = { id: 'b', line: JSON.stringify(entry('b', 'second', '2026-11-27T10:00:02Z')) };
    const early = { id: 'a', line: JSON.stringify(entry('a', 'first', '2026-11-27T10:00:01Z')) };
    expect(inTimeOrder([late, early, late]).map((event) => event.id)).toEqual(['a', 'b']);
  });

  it('cuts a tool output too large for the API instead of losing the line', () => {
    const big = JSON.stringify({ type: 'user', uuid: 'u', output: 'x'.repeat(200_000) });
    const cut = fitLine(big);
    expect(cut && new TextEncoder().encode(cut).length).toBeLessThanOrEqual(64_000);
    expect(JSON.parse(cut ?? '{}').uuid).toBe('u');
  });
});

describe('reading a session’s log from claude.ai', () => {
  it('tries the route the page taught first, then the CLI’s, and reads every page', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        calls.push(href);
        if (href.startsWith('https://claude.ai/learned/')) return json({}, 404);
        if (href.includes('cursor=c2')) return json({ data: [{ payload: entry('u2', 'b') }] });
        return json({ data: [{ payload: entry('u1', 'a') }], next_cursor: 'c2' });
      }),
    );
    const read = await fetchSessionEvents(ID, {}, 'https://claude.ai/learned/{id}/events');
    expect(calls[0]).toBe(`https://claude.ai/learned/${ID}/events`);
    expect(calls[1]).toContain(`/v1/code/sessions/${ID}/teleport-events`);
    expect(read?.events.map((event) => event.id)).toEqual(['u1', 'u2']);
  });

  it('answers nothing when no route has the log, rather than an empty one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'nope' }, 403)),
    );
    // Breaks if a signed-out read is sent as an empty chat.
    expect(await fetchSessionEvents(ID, {}, null)).toBeNull();
  });
});

describe('sending the log to the console', () => {
  const events: ChatEvent[] = Array.from({ length: EVENTS_BATCH + 5 }, (_, i) => ({
    id: `e${i}`,
    line: JSON.stringify(entry(`e${i}`, 'x')),
  }));

  it('sends only what the console does not have, in batches it takes, with the title', async () => {
    const bodies: { events: ChatEvent[]; title?: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return json({ sessionId: 's', accepted: 1 });
      }),
    );
    const session = { id: ID, title: 'Fix the login page' };
    expect(await forwardEvents(connection, session, events, 3)).toBe(events.length);
    expect(bodies.map((body) => body.events.length)).toEqual([EVENTS_BATCH, 2]);
    expect(bodies[0]?.events[0]?.id).toBe('e3');
    expect(bodies[0]?.title).toBe('Fix the login page');
    // Nothing new: nothing sent.
    expect(await forwardEvents(connection, session, events, events.length)).toBe(events.length);
    expect(bodies).toHaveLength(2);
  });

  it('keeps each request under the API’s body limit, however long the lines', async () => {
    // Ordinary assistant and tool entries of about 3 KB: 200 of them were 627 KB.
    const big: ChatEvent[] = Array.from({ length: 300 }, (_, i) => ({
      id: `b${i}`,
      line: JSON.stringify({ type: 'assistant', uuid: `b${i}`, text: 'x'.repeat(3_000) }),
    }));
    const sizes: number[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sizes.push(new TextEncoder().encode(String(init.body)).length);
        return json({ sessionId: 's', accepted: 1 });
      }),
    );
    // Breaks if a batch goes over 512 KB: the API answers 413 and the session never syncs.
    expect(await forwardEvents(connection, { id: ID, title: 't' }, big, 0)).toBe(300);
    expect(Math.max(...sizes)).toBeLessThan(512 * 1024);
    // A tool's read of a JSON file grows by a third once escaped in the body.
    const quoted: ChatEvent[] = Array.from({ length: 40 }, (_, i) => ({
      id: `q${i}`,
      line: JSON.stringify({ type: 'user', uuid: `q${i}`, output: '{"a":"b\\c"}'.repeat(2_500) }),
    }));
    sizes.length = 0;
    expect(await forwardEvents(connection, { id: ID, title: 't' }, quoted, 0)).toBe(40);
    expect(Math.max(...sizes)).toBeLessThan(512 * 1024);
    // One line too large to share a batch still goes, alone.
    const huge = [{ id: 'h', line: 'x'.repeat(EVENTS_BATCH_BYTES) }];
    expect(nextBatch(huge, 0)).toHaveLength(1);
  });

  it('cuts a title to what the API counts, never through an emoji', () => {
    // Breaks if 200 characters with an emoji in them are refused as over 200.
    const cut = cutTitle(`${'a'.repeat(199)}😀 and more`) ?? '';
    expect(cut).toBe('a'.repeat(199));
    expect(cutTitle(`${'a'.repeat(150)}${'😀'.repeat(60)}`)?.length).toBeLessThanOrEqual(200);
    expect(cutTitle('   ')).toBeUndefined();
  });

  it('stops at a batch the API refuses, so the next read sends it again', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ title: 'Too Many Requests' }, 429)),
    );
    await expect(forwardEvents(connection, { id: ID, title: 't' }, events, 0)).rejects.toThrow(
      '429',
    );
  });
});

describe('posting a reply on claude.ai', () => {
  const reply = {
    id: '0b8f0c2e-6b8c-4f1e-9c9e-2f0e6b0e8a11',
    cloudSessionId: ID,
    text: 'Also the signup page',
  };

  it('posts it as the person’s message, with the reply’s id so a repeat is one message', async () => {
    const init = vi.fn(async (_url: string, _init: RequestInit) => json({}));
    vi.stubGlobal('fetch', init);
    expect(await postReply(reply, { 'x-organization-uuid': 'org' })).toEqual({ ok: true });
    const [url, sent] = init.mock.calls[0] ?? [];
    expect(url).toBe(`https://claude.ai/v1/sessions/${ID}/events`);
    expect(JSON.parse(String(sent?.body))).toEqual({
      events: [
        {
          type: 'user',
          uuid: reply.id,
          parent_tool_use_id: null,
          message: { role: 'user', content: 'Also the signup page' },
        },
      ],
    });
    expect(sent?.credentials).toBe('include');
  });

  it('says why when claude.ai takes it on neither route, so it is handed back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({}, 403)),
    );
    expect(await postReply(reply, {})).toEqual({ ok: false, reason: '403' });
  });
});

describe('which sessions a pass reads', () => {
  const now = Date.parse('2026-11-27T12:00:00Z');
  const tracked = (id: string, patch: Partial<TrackedSession>): TrackedSession => ({
    id,
    title: id,
    state: 'done',
    reason: null,
    repo: null,
    updatedAt: '2026-11-27T11:00:00Z',
    ...patch,
  });
  const running = tracked('session_running000001', { state: 'running' });
  const fresh = tracked('session_freshdone0001', {});
  const read = tracked('session_alreadyread01', {});
  const old = tracked('session_lastweek00001', { updatedAt: '2026-11-20T11:00:00Z' });
  const replied = tracked('session_repliedto0001', { updatedAt: '2026-11-01T11:00:00Z' });

  it('reads the moving ones, the replied-to ones and, once, the ones active today', () => {
    const due = sessionsToSync(
      [running, fresh, read, old, replied],
      { [read.id]: { sent: 4, at: read.updatedAt ?? '' } },
      new Set([replied.id]),
      now,
    );
    // Breaks if every session ever started on claude.ai is pulled into the
    // console, or one the person is talking to waits for the next minute.
    expect(due.map((session) => session.id)).toEqual([running.id, fresh.id, replied.id]);
  });
});
