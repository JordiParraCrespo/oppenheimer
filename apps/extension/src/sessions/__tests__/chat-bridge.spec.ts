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
});
