import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHAT_COPY_VERSION,
  type ChatEvent,
  cutTitle,
  EVENTS_BATCH,
  EVENTS_BATCH_BYTES,
  eventsPage,
  eventsUrls,
  fetchSessionEvents,
  fitLine,
  forwardEvents,
  forwardNewestFirst,
  idPlaceholder,
  nextBatch,
  pagesNewestFirst,
  postReply,
  sessionsToSync,
} from '../chat';
import { type TrackedSession, toTracked } from '../session';

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

  it('gives an entry with no time of its own the time on its row', () => {
    // Regression: a reply posted from the console has no `timestamp`, so its
    // turn had no start ("Worked for" with no time) and the read was left unsorted.
    const page = eventsPage({
      data: [
        {
          created_at: '2026-11-28T10:00:00Z',
          payload: { type: 'user', uuid: 'r1', message: { role: 'user', content: 'Go on' } },
        },
      ],
    });
    expect(JSON.parse(page?.events[0]?.line ?? '{}').timestamp).toBe('2026-11-28T10:00:00Z');
  });

  it('is no page for a body that is not one', () => {
    expect(eventsPage({ sessions: [] })).toBeNull();
    expect(eventsPage(null)).toBeNull();
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
    expect(calls[1]).toContain(
      `/v1/code/sessions/${ID.replace('session_', 'cse_')}/teleport-events`,
    );
    expect(read?.events.map((event) => event.id)).toEqual(['u1', 'u2']);
  });

  it('reads the code-session routes under the `cse_` id, and a learned route in the form the page used', () => {
    // Regression: the canonical `session_` id went into `/v1/code/sessions/…`,
    // which takes `cse_`, so no log was read where the session API's is missing.
    const cse = ID.replace('session_', 'cse_');
    const urls = eventsUrls(
      ID,
      `https://claude.ai/v1/code/sessions/${idPlaceholder(cse)}/teleport-events`,
    );
    expect(urls[0]).toBe(`https://claude.ai/v1/code/sessions/${cse}/teleport-events`);
    expect(urls).toContain(`https://claude.ai/v1/sessions/${ID}/events?limit=1000`);
    expect(eventsUrls(ID, `https://claude.ai/learned/${idPlaceholder(ID)}/events`)[0]).toBe(
      `https://claude.ai/learned/${ID}/events`,
    );
  });

  it('keeps the log’s own order, so an event that comes late with an earlier time is still sent', async () => {
    // Regression: a reread sorted by time put a late `c@10:00:02` before
    // `b@10:00:03`, so skipping the two already sent skipped `c` for good.
    const log = [
      { payload: entry('a', 'first', '2026-11-27T10:00:00Z') },
      { payload: entry('b', 'second', '2026-11-27T10:00:03Z') },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ data: log })),
    );
    expect((await fetchSessionEvents(ID, {}, null))?.events.map((event) => event.id)).toEqual([
      'a',
      'b',
    ]);
    log.push({ payload: entry('c', 'third', '2026-11-27T10:00:02Z') });
    const reread = await fetchSessionEvents(ID, {}, null);
    expect(reread?.events.slice(2).map((event) => event.id)).toEqual(['c']);
  });

  it('stops a long log at the page cap and carries on from there, never from its start again', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        urls.push(href);
        const page = Number(new URL(href).searchParams.get('cursor') ?? '0');
        return json({ data: [{ payload: entry(`p${page}`, 'x') }], next_cursor: String(page + 1) });
      }),
    );
    const first = await fetchSessionEvents(ID, {}, null);
    // Breaks if a log past the cap is re-read from its first page on every pass.
    expect(first).toMatchObject({ offset: 0, complete: false });
    expect(first?.events).toHaveLength(20);
    expect(first?.resume).toMatchObject({ cursor: '20', offset: 20 });
    urls.length = 0;
    const second = await fetchSessionEvents(ID, {}, null, first?.resume ?? null);
    expect(new URL(urls[0] ?? '').searchParams.get('cursor')).toBe('20');
    expect(second?.offset).toBe(20);
    expect(second?.events[0]?.id).toBe('p20');
  });

  it('says a read a failed page cut short is incomplete, and where to carry on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) =>
        new URL(String(url)).searchParams.get('cursor')
          ? json({}, 502)
          : json({ data: [{ payload: entry('u1', 'a') }], next_cursor: 'c2' }),
      ),
    );
    // Breaks if a transient failure marks the session read, and the rest of its log never comes.
    const read = await fetchSessionEvents(ID, {}, null);
    expect(read).toMatchObject({ complete: false, resume: { cursor: 'c2', offset: 1 } });
  });

  it('remembers the last page of a log read to its end, where new events land', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) =>
        new URL(String(url)).searchParams.get('cursor')
          ? json({ data: [{ payload: entry('u2', 'b') }] })
          : json({ data: [{ payload: entry('u1', 'a') }], next_cursor: 'c2' }),
      ),
    );
    const read = await fetchSessionEvents(ID, {}, null);
    expect(read).toMatchObject({ complete: true, resume: { cursor: 'c2', offset: 1 } });
  });

  it('skips a route that pages newest first, whose last page is the oldest', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        urls.push(href);
        if (href.startsWith('https://claude.ai/learned/')) {
          return json({
            data: [{ payload: entry('n2', 'b') }],
            sort_order: 'desc',
            next_cursor: 'c',
          });
        }
        return json({ data: [{ payload: entry('u1', 'a') }] });
      }),
    );
    // Breaks if a newest-first route is carried on from its last page, which
    // holds its oldest events, and new messages never come.
    const read = await fetchSessionEvents(ID, {}, 'https://claude.ai/learned/{id}/events');
    expect(urls[1]).toContain('/teleport-events');
    expect(read?.events.map((event) => event.id)).toEqual(['u1']);
    expect(pagesNewestFirst('https://claude.ai/x/events?sort_order=desc')).toBe(true);
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
    // Its place in the log: the read's own offset plus what was sent of it.
    expect((bodies[0] as { from?: number }).from).toBe(3);
    expect(bodies[0]?.title).toBe('Fix the login page');
    // Nothing new: nothing sent.
    expect(await forwardEvents(connection, session, events, events.length)).toBe(events.length);
    expect(bodies).toHaveLength(2);
  });

  it('starts a copy with the log’s newest stretch, then sends each older one before it', async () => {
    // Regression: a long session's copy was sent oldest first and kept the
    // order it arrived in, so the console opened on its oldest turns.
    const bodies: { events: ChatEvent[]; from?: number }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return json({ sessionId: 's', accepted: 1 });
      }),
    );
    expect(
      await forwardNewestFirst(connection, { id: ID, title: 'Fix the login page' }, events),
    ).toBe(events.length);
    // Each batch says its place in the log, so the API keeps the log's order.
    expect(bodies.map((body) => body.from)).toEqual([EVENTS_BATCH, 0]);
    expect(bodies[0]?.events.map((event) => event.id)).toEqual([
      'e200',
      'e201',
      'e202',
      'e203',
      'e204',
    ]);
    expect(bodies[1]?.events[0]?.id).toBe('e0');
    expect(bodies[1]?.events).toHaveLength(EVENTS_BATCH);
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
  const online = () => true;
  const reply = {
    id: '0b8f0c2e-6b8c-4f1e-9c9e-2f0e6b0e8a11',
    cloudSessionId: ID,
    text: 'Also the signup page',
  };
  const answering = (...statuses: number[]) =>
    vi.fn(async (_url: string, _body: unknown, _headers: Record<string, string>) => ({
      status: statuses.shift() ?? 500,
    }));

  it('posts it as the person’s message on the route claude.ai’s own page uses, under the reply’s id', async () => {
    const send = answering(200);
    expect(await postReply(reply, { 'x-organization-uuid': 'org' }, send, online)).toEqual({
      outcome: 'posted',
    });
    const [url, body, headers] = send.mock.calls[0] ?? [];
    // Breaks if the post goes to a route claude.ai's page does not use, or
    // under a `session_` id that route does not take.
    expect(url).toBe(`https://claude.ai/v1/code/sessions/${ID.replace('session_', 'cse_')}/events`);
    expect(body).toEqual({
      events: [
        {
          payload: {
            type: 'user',
            uuid: reply.id,
            parent_tool_use_id: null,
            message: { role: 'user', content: 'Also the signup page' },
          },
        },
      ],
    });
    expect(headers).toMatchObject({
      'x-organization-uuid': 'org',
      'Content-Type': 'application/json',
    });
  });

  it('tries the session API when claude.ai’s own route certainly refused', async () => {
    const send = answering(404, 200);
    expect(await postReply(reply, {}, send, online)).toEqual({ outcome: 'posted' });
    expect(send.mock.calls[1]?.[0]).toBe(`https://claude.ai/v1/sessions/${ID}/events`);
  });

  it('counts a post that got no answer as maybe delivered, and tries no other route', async () => {
    const send = vi.fn(async () => {
      throw new Error('no answer');
    });
    // Breaks if a post claude.ai may have taken is handed to the hook or a
    // host, or posted again on the second route: the agent would get it twice.
    expect(await postReply(reply, {}, send, online)).toEqual({ outcome: 'uncertain' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('refuses at once when Chrome is offline, as nothing went', async () => {
    const send = answering(200);
    expect(await postReply(reply, {}, send, () => false)).toEqual({
      outcome: 'refused',
      reason: 'offline',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('says why when claude.ai takes it on neither route, or no claude.ai tab could take it', async () => {
    expect(await postReply(reply, {}, answering(401, 403), online)).toEqual({
      outcome: 'refused',
      reason: '403',
    });
    expect(await postReply(reply, {}, answering(0, 0), online)).toEqual({
      outcome: 'refused',
      reason: 'no claude.ai tab',
    });
  });
});

describe('the ids claude.ai’s list answers', () => {
  it('keeps a session listed as `cse_…` under its `session_…` id, which the console and the API take', () => {
    // Breaks if claude.ai's own list, which answers `cse_` ids, is dropped by
    // every filter that takes `session_` ids: nothing would be carried at all.
    const tracked = toTracked({
      id: 'cse_01KpKLr5SuVydUo7t2s3fBcP',
      title: 'Fix login',
      status: 'active',
      worker_status: 'running',
    });
    expect(tracked?.id).toBe('session_01KpKLr5SuVydUo7t2s3fBcP');
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
      { [read.id]: { sent: 4, at: read.updatedAt ?? '', copy: CHAT_COPY_VERSION } },
      new Set([replied.id]),
      now,
    );
    // Breaks if every session ever started on claude.ai is pulled into the
    // console, or one the person is talking to waits for the next minute.
    expect(due.map((session) => session.id)).toEqual([replied.id, running.id, fresh.id]);
  });

  it('reads the longest unread first, so a cap on a pass reaches every busy session', () => {
    const busy = Array.from({ length: 12 }, (_, i) =>
      tracked(`session_busy${String(i).padStart(12, '0')}`, { state: 'running' }),
    );
    // The first ten were read on the last pass; the last two never were.
    const synced = Object.fromEntries(
      busy
        .slice(0, 10)
        .map((session) => [
          session.id,
          { sent: 1, at: '', readAt: '2026-11-27T11:59:00Z', copy: CHAT_COPY_VERSION },
        ]),
    );
    // Breaks if the same ten are read on every pass and the rest never are.
    const due = sessionsToSync(busy, synced, new Set(), now);
    expect(due.slice(0, 2).map((session) => session.id)).toEqual([busy[10]?.id, busy[11]?.id]);
  });

  it('reads a copy built by older rules once, however long its session has been still, and first', () => {
    // Regression: a session that had not moved since the upgrade kept its old
    // copy for good, with its lines out of order and some cut short.
    const stillUpgraded = tracked('session_stillupgraded', { updatedAt: '2026-11-20T11:00:00Z' });
    const stillCurrent = tracked('session_stillcurrent1', { updatedAt: '2026-11-20T11:00:00Z' });
    const synced = {
      [stillUpgraded.id]: {
        sent: 40,
        at: stillUpgraded.updatedAt ?? '',
        readAt: '2026-11-27T11:59:00Z',
      },
      [stillCurrent.id]: {
        sent: 40,
        at: stillCurrent.updatedAt ?? '',
        readAt: '2026-11-27T11:59:00Z',
        copy: CHAT_COPY_VERSION,
      },
      [running.id]: { sent: 2, at: '', readAt: '2026-11-27T11:58:00Z', copy: CHAT_COPY_VERSION },
    };
    const due = sessionsToSync([running, stillCurrent, stillUpgraded], synced, new Set(), now);
    expect(due.map((session) => session.id)).toEqual([stillUpgraded.id, running.id]);
    // Once read under the current rules, it is still again until it moves.
    const after = {
      ...synced,
      [stillUpgraded.id]: { ...synced[stillUpgraded.id], copy: CHAT_COPY_VERSION },
    };
    expect(sessionsToSync([stillUpgraded], after, new Set(), now)).toEqual([]);
  });
});
