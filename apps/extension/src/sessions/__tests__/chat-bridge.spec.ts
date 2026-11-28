import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatBridge } from '../chat-bridge';

const FIRST = 'session_01FirstSessionAaaaaaaa';
const SECOND = 'session_01SecondSessionBbbbbbb';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** `chrome.storage.local` as a plain object, so a spec can read what the worker kept. */
function fakeStorage(initial: Record<string, unknown>) {
  const data: Record<string, unknown> = { ...initial };
  // Not a stub that is taken away after the spec: a loop still sleeping then
  // reads storage once more, finds no connection and ends.
  Object.assign(globalThis, {
    chrome: {
      storage: {
        local: {
          get: async (keys: string[]) =>
            Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, data[key]])),
          set: async (patch: Record<string, unknown>) => Object.assign(data, patch),
          remove: async (keys: string | string[]) => {
            for (const key of [keys].flat()) delete data[key];
          },
        },
      },
    },
  });
  return data;
}

afterEach(() => vi.unstubAllGlobals());

describe('a pass over the sessions that are moving', () => {
  it('keeps each session’s place as soon as it is carried, so a worker stopped mid-pass does not start over', async () => {
    const recent = new Date().toISOString();
    const data = fakeStorage({
      oppenheimer: { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_x' },
      sessions: {
        [FIRST]: {
          id: FIRST,
          title: 'First',
          state: 'done',
          reason: null,
          repo: null,
          updatedAt: recent,
        },
        [SECOND]: {
          id: SECOND,
          title: 'Second',
          state: 'done',
          reason: null,
          repo: null,
          updatedAt: recent,
        },
      },
    });
    const event = (id: string) => ({
      payload: { type: 'user', uuid: id, message: { content: id } },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes(FIRST.replace('session_', 'cse_')) || url.includes(FIRST))
          return json({ data: [event('a'), event('b')] });
        // The second session's log never answers: the worker is stopped here.
        if (url.includes('claude.ai')) return new Promise<Response>(() => {});
        return json({ accepted: 1 });
      }),
    );
    const bridge = createChatBridge({
      claudeHeaders: async () => ({}),
      serial: (task) => task(),
      postToClaude: async () => ({ status: 500 }),
    });

    void bridge.syncPass();
    await vi.waitFor(() =>
      expect((data.chatSync as Record<string, { sent: number }>)?.[FIRST]?.sent).toBe(2),
    );
    // Breaks if the place is written only once the whole pass ends: a pass the
    // worker never finishes then reads and sends the first session again, forever.
    expect((data.chatSync as Record<string, unknown>)[SECOND]).toBeUndefined();
  });

  it('posts a reply while a long log is still being carried, so a reply never waits on the sync', async () => {
    const recent = new Date().toISOString();
    const data = fakeStorage({
      oppenheimer: { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_x' },
      sessions: {
        [FIRST]: {
          id: FIRST,
          title: 'First',
          state: 'done',
          reason: null,
          repo: null,
          updatedAt: recent,
        },
      },
    });
    let claims = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        // claude.ai's log never finishes reading: once a sync starts, it is busy for good.
        // The reply comes on the second claim, after the first sync has begun.
        if (url.includes('claude.ai')) return new Promise<Response>(() => {});
        if (url.endsWith('/cloud-replies/claim')) {
          claims += 1;
          return json({
            replies: claims === 2 ? [{ id: 'r1', cloudSessionId: FIRST, text: 'hi' }] : [],
          });
        }
        return json({ delivered: true });
      }),
    );
    vi.stubGlobal('navigator', { onLine: true });
    const posted = vi.fn(async () => ({ status: 200 }));
    createChatBridge({
      claudeHeaders: async () => ({}),
      serial: (task) => task(),
      postToClaude: posted,
    }).run();

    // Breaks if replies are claimed only between sync passes: this one would
    // wait behind a read that never ends.
    try {
      await vi.waitFor(() => expect(posted).toHaveBeenCalledTimes(1), { timeout: 4_000 });
    } finally {
      delete data.oppenheimer;
    }
  });

  it('posts replies again after a disconnect and reconnect that came while a log was being read', async () => {
    const recent = new Date().toISOString();
    const connection = { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_x' };
    const data = fakeStorage({
      oppenheimer: connection,
      sessions: {
        [FIRST]: {
          id: FIRST,
          title: 'First',
          state: 'done',
          reason: null,
          repo: null,
          updatedAt: recent,
        },
      },
    });
    let offer = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        // The log takes 4 s: the sync is mid-read through the disconnect.
        if (url.includes('claude.ai'))
          return new Promise<Response>((resolve) =>
            setTimeout(() => resolve(json({ data: [] })), 4_000),
          );
        if (url.endsWith('/cloud-replies/claim')) {
          // Handed out once, as the API does: a claim takes it.
          const replies = offer ? [{ id: 'r1', cloudSessionId: FIRST, text: 'hi' }] : [];
          offer = false;
          return json({ replies });
        }
        return json({ delivered: true });
      }),
    );
    vi.stubGlobal('navigator', { onLine: true });
    const posted = vi.fn(async () => ({ status: 200 }));
    const bridge = createChatBridge({
      claudeHeaders: async () => ({}),
      serial: (task) => task(),
      postToClaude: posted,
    });
    bridge.run();
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      delete data.oppenheimer;
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      data.oppenheimer = connection;
      bridge.run();
      offer = true;
      // Breaks if one flag holds all three loops: the sync loop, still
      // reading, keeps it set, and the reply loop that ended never restarts.
      await vi.waitFor(() => expect(posted).toHaveBeenCalledTimes(1), { timeout: 4_000 });
    } finally {
      delete data.oppenheimer;
    }
  }, 15_000);

  it('keeps no place for a log read across a disconnect', async () => {
    const recent = new Date().toISOString();
    const data = fakeStorage({
      oppenheimer: { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_x' },
      sessions: {
        [FIRST]: {
          id: FIRST,
          title: 'First',
          state: 'done',
          reason: null,
          repo: null,
          updatedAt: recent,
        },
      },
    });
    const event = { payload: { type: 'user', uuid: 'a', message: { content: 'a' } } };
    const read: { answer?: (response: Response) => void } = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        String(input).includes('claude.ai')
          ? new Promise<Response>((resolve) => {
              read.answer = resolve;
            })
          : json({ accepted: 1 }),
      ),
    );
    const bridge = createChatBridge({
      claudeHeaders: async () => ({}),
      serial: (task) => task(),
      postToClaude: async () => ({ status: 500 }),
    });
    const pass = bridge.syncPass();
    await vi.waitFor(() => expect(read.answer).toBeDefined());
    // Disconnected while the log was on its way: the stored places go.
    delete data.oppenheimer;
    delete data.chatSync;
    read.answer?.(json({ data: [event] }));
    await pass;
    // Breaks if the place is written back: a later connection, to another
    // workspace, would believe this session's events already went there.
    expect(data.chatSync).toBeUndefined();
  });

  it('carries the other sessions when one session’s log cannot be read', async () => {
    const recent = new Date().toISOString();
    const data = fakeStorage({
      oppenheimer: { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_x' },
      sessions: {
        [FIRST]: {
          id: FIRST,
          title: 'First',
          state: 'done',
          reason: null,
          repo: null,
          updatedAt: recent,
        },
        [SECOND]: {
          id: SECOND,
          title: 'Second',
          state: 'done',
          reason: null,
          repo: null,
          updatedAt: recent,
        },
      },
    });
    const event = { payload: { type: 'user', uuid: 'b', message: { content: 'b' } } };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        if (
          url.includes('claude.ai') &&
          (url.includes(FIRST) || url.includes(FIRST.replace('session_', 'cse_')))
        )
          throw new TypeError('Failed to fetch');
        if (url.includes('claude.ai')) return json({ data: [event] });
        return json({ accepted: 1 });
      }),
    );
    const bridge = createChatBridge({
      claudeHeaders: async () => ({}),
      serial: (task) => task(),
      postToClaude: async () => ({ status: 500 }),
    });
    expect(await bridge.syncPass()).toContain(FIRST);
    // Breaks if the first failure ends the pass: one session claude.ai will
    // not give, read first on every pass, would stop every other chat.
    expect((data.chatSync as Record<string, { sent: number }>)[SECOND]?.sent).toBe(1);
  });

  it('keeps no place for a log read before a reconnect to another workspace', async () => {
    const recent = new Date().toISOString();
    const data = fakeStorage({
      oppenheimer: { apiUrl: 'http://old:3001', token: 'oppenheimer_pat_old' },
      sessions: {
        [FIRST]: {
          id: FIRST,
          title: 'First',
          state: 'done',
          reason: null,
          repo: null,
          updatedAt: recent,
        },
      },
    });
    const event = { payload: { type: 'user', uuid: 'a', message: { content: 'a' } } };
    const read: { answer?: (response: Response) => void } = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        String(input).includes('claude.ai')
          ? new Promise<Response>((resolve) => {
              read.answer = resolve;
            })
          : json({ accepted: 1 }),
      ),
    );
    const bridge = createChatBridge({
      claudeHeaders: async () => ({}),
      serial: (task) => task(),
      postToClaude: async () => ({ status: 500 }),
    });
    const pass = bridge.syncPass();
    await vi.waitFor(() => expect(read.answer).toBeDefined());
    data.oppenheimer = { apiUrl: 'http://new:3001', token: 'oppenheimer_pat_new' };
    delete data.chatSync;
    read.answer?.(json({ data: [event] }));
    await pass;
    // Breaks if the old connection's place lands in the new one: the new
    // workspace would never be sent those events.
    expect(data.chatSync).toBeUndefined();
  });

  it('reads the other sessions while one never-read log keeps failing slowly', async () => {
    const recent = new Date().toISOString();
    const data = fakeStorage({
      oppenheimer: { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_x' },
      sessions: {
        [FIRST]: {
          id: FIRST,
          title: 'First',
          state: 'done',
          reason: null,
          repo: null,
          updatedAt: recent,
        },
        [SECOND]: {
          id: SECOND,
          title: 'Second',
          state: 'done',
          reason: null,
          repo: null,
          updatedAt: recent,
        },
      },
    });
    const real = Date.now.bind(Date);
    let skew = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => real() + skew);
    const event = { payload: { type: 'user', uuid: 'b', message: { content: 'b' } } };
    let secondReads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        if (
          url.includes('claude.ai') &&
          (url.includes(FIRST) || url.includes(FIRST.replace('session_', 'cse_')))
        ) {
          // Times out past the whole pass budget, then fails.
          skew += 21_000;
          throw new DOMException('timed out', 'TimeoutError');
        }
        if (url.includes('claude.ai')) {
          secondReads += 1;
          return json({ data: [event] });
        }
        return json({ accepted: 1 });
      }),
    );
    const bridge = createChatBridge({
      claudeHeaders: async () => ({}),
      serial: (task) => task(),
      postToClaude: async () => ({ status: 500 }),
    });
    try {
      for (let pass = 0; pass < 3; pass += 1) await bridge.syncPass();
    } finally {
      vi.restoreAllMocks();
    }
    // Breaks if a failed read is kept as never read: it sorts first on every
    // pass, takes the budget, and no other chat reaches the console again.
    expect(secondReads).toBeGreaterThan(0);
    expect((data.chatSync as Record<string, { sent: number }>)[SECOND]?.sent).toBe(1);
  });
});
