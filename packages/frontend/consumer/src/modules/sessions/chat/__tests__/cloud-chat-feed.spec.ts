import {
  CLOUD_CHAT_PAGE_LINES,
  CLOUD_REPLY_PREAMBLE,
} from '@oppenheimer/shared/schemas/session-cloud-chat';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudChatFeed, type CloudChatPage, type CloudChatSource } from '../cloud-chat-feed';
import { SessionChat } from '../session-chat';

const line = (value: unknown) => JSON.stringify(value);

function sourceOf(pages: CloudChatPage[]) {
  const replies: string[] = [];
  const source: CloudChatSource = {
    read: vi.fn(
      async () => pages.shift() ?? { lines: [], next: 0, source: 'hook' as const, replies: [] },
    ),
    reply: vi.fn(async (text: string) => {
      replies.push(text);
    }),
  };
  return { source, replies };
}

afterEach(() => vi.useRealTimers());

describe('CloudChatFeed', () => {
  it('draws a reply the Stop hook handed the agent as the person’s message, where the agent took it', async () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const { source } = sourceOf([
      {
        next: 3,
        replies: [],
        source: 'hook',
        lines: [
          line({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'Ship it' } }),
          line({
            type: 'assistant',
            uuid: 'a1',
            message: { role: 'assistant', content: [{ type: 'text', text: 'Shipped.' }] },
          }),
          line({
            type: 'user',
            uuid: 'u2',
            isMeta: true,
            message: {
              role: 'user',
              content: `Stop hook feedback:\n[node stop.mjs]: ${CLOUD_REPLY_PREAMBLE}\n\nNow tag the release`,
            },
          }),
        ],
      },
    ]);
    const feed = new CloudChatFeed(source, chat, {
      everyMs: 1000,
      onPending: () => {},
      onReplyFailed: () => {},
    });

    const stop = feed.start();
    await vi.advanceTimersByTimeAsync(0);
    // Breaks if the hidden feedback line is drawn as nothing (or as hook noise).
    const prompts = chat.snapshot().turns.map((turn) => turn.prompt?.text);
    expect(prompts).toEqual(['Ship it', 'Now tag the release']);
    stop();
  });

  it('sends what the composer typed, up to Enter, as one reply, and drops Escape', async () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const { source, replies } = sourceOf([]);
    const feed = new CloudChatFeed(source, chat, {
      everyMs: 1000,
      onPending: () => {},
      onReplyFailed: () => {},
    });
    const stop = feed.start();

    chat.send('First line\nsecond line');
    chat.interrupt();
    await vi.advanceTimersByTimeAsync(500);
    // Breaks if the paste marks reach the agent, Escape is sent as text, or
    // a message goes as one reply per piece the chat typed.
    expect(replies).toEqual(['First line\nsecond line']);
    stop();
  });

  it('draws a reply in the chat the moment it is sent, mid-turn too, until claude.ai’s copy of it comes back', async () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const working = [
      line({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'Audit the repo' } }),
      line({
        type: 'assistant',
        uuid: 'a1',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }],
        },
      }),
    ];
    const echo = line({
      type: 'user',
      uuid: 'u2',
      message: { role: 'user', content: 'How are you' },
    });
    const { source } = sourceOf([
      { next: 2, replies: [], source: 'browser', lines: working },
      { next: 2, replies: [], source: 'browser', lines: [] },
      { next: 3, replies: [], source: 'browser', lines: [echo] },
    ]);
    const feed = new CloudChatFeed(source, chat, {
      everyMs: 1000,
      onPending: () => {},
      onReplyFailed: () => {},
    });
    const stop = feed.start();
    await vi.advanceTimersByTimeAsync(0);

    chat.post('How are you');
    // Breaks if a cloud chat waits for the log to show the person's message:
    // it would sit unseen for the seconds the extension and claude.ai take.
    expect(chat.snapshot().sending.map((held) => held.text)).toEqual(['How are you']);

    await vi.advanceTimersByTimeAsync(2_000);
    // Breaks if the drawn message stays beside claude.ai's copy of it: shown twice.
    expect(chat.snapshot().sending).toEqual([]);
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual([
      'Audit the repo',
      'How are you',
    ]);
    stop();
  });

  it('shows a reply a host sent as sent until the transcript has it, and one the hook holds as waiting', async () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const at = new Date('2026-11-11T10:00:00Z');
    const sent = {
      id: 'r1',
      text: 'Now tag the release',
      createdAt: at,
      collectedAt: at,
      deliveredVia: 'host' as const,
    };
    const waiting = {
      ...sent,
      id: 'r2',
      text: 'And the notes',
      collectedAt: null,
      deliveredVia: null,
    };
    const echo = line({
      type: 'user',
      uuid: 'u1',
      message: {
        role: 'user',
        content: [{ type: 'text', text: `${CLOUD_REPLY_PREAMBLE}\n\nNow tag the release` }],
      },
    });
    const { source } = sourceOf([
      { lines: [], next: 0, source: 'hook', replies: [sent, waiting] },
      { lines: [echo], next: 1, source: 'hook', replies: [sent, waiting] },
    ]);
    const pending: string[][] = [];
    const feed = new CloudChatFeed(source, chat, {
      everyMs: 1000,
      onPending: (now) => pending.push(now.map((reply) => `${reply.id}:${reply.state}`)),
      onReplyFailed: () => {},
    });

    const stop = feed.start();
    await vi.advanceTimersByTimeAsync(1000);
    // Breaks if a host's reply vanishes before the session ran it, or stays
    // once its words are back (a prompt's one text block, not only a string).
    expect(pending).toEqual([['r1:sent', 'r2:waiting'], ['r2:waiting']]);
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual(['Now tag the release']);
    stop();
  });

  it('reads the chat again from its first line when the extension’s lines replace the hook’s', async () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const prompt = (uuid: string, text: string) =>
      line({ type: 'user', uuid, message: { role: 'user', content: text } });
    const { source } = sourceOf([
      { lines: [prompt('h1', 'Fix the login page')], next: 1, source: 'hook', replies: [] },
      {
        lines: [prompt('e1', 'Fix the login page'), prompt('e2', 'Also the signup page')],
        next: 2,
        source: 'browser',
        replies: [],
      },
      {
        lines: [prompt('e1', 'Fix the login page'), prompt('e2', 'Also the signup page')],
        next: 2,
        source: 'browser',
        replies: [],
      },
    ]);
    const feed = new CloudChatFeed(source, chat, {
      everyMs: 1000,
      onPending: () => {},
      onReplyFailed: () => {},
    });
    const stop = feed.start();
    await vi.advanceTimersByTimeAsync(1000);
    // Breaks if the extension's lines are read on from the hook's number
    // (dropping the start of the log) or drawn after the hook's (twice).
    expect(source.read).toHaveBeenNthCalledWith(2, 1);
    expect(source.read).toHaveBeenNthCalledWith(3, null);
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual([
      'Fix the login page',
      'Also the signup page',
    ]);
    stop();
  });

  it('still draws the chat from scratch when the first read after the switch fails', async () => {
    // Regression: the switch changed the source, its reread failed, and the
    // retry appended the extension's lines after the hook's.
    vi.useFakeTimers();
    const chat = new SessionChat();
    const prompt = (uuid: string, text: string) =>
      line({ type: 'user', uuid, message: { role: 'user', content: text } });
    const logged = [prompt('e1', 'Fix the login page'), prompt('e2', 'Also the signup page')];
    const pages: (CloudChatPage | Error)[] = [
      { lines: [prompt('h1', 'Fix the login page')], next: 1, source: 'hook', replies: [] },
      { lines: logged, next: 2, source: 'browser', replies: [] },
      new Error('offline'),
      { lines: logged, next: 2, source: 'browser', replies: [] },
    ];
    const source: CloudChatSource = {
      read: vi.fn(async () => {
        const page = pages.shift() ?? {
          lines: [],
          next: 2,
          source: 'browser' as const,
          replies: [],
        };
        if (page instanceof Error) throw page;
        return page;
      }),
      reply: vi.fn(async () => {}),
    };
    const feed = new CloudChatFeed(source, chat, {
      everyMs: 1000,
      onPending: () => {},
      onReplyFailed: () => {},
    });
    const stop = feed.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual([
      'Fix the login page',
      'Also the signup page',
    ]);
    stop();
  });

  it('reads a long chat’s pages back to back and draws it once, at its latest turn', async () => {
    // Regression: one page of 500 lines a tick, so a long chat showed its
    // oldest turns for a minute before its latest.
    vi.useFakeTimers();
    const chat = new SessionChat();
    const prompt = (n: number) =>
      line({ type: 'user', uuid: `p${n}`, message: { role: 'user', content: `turn ${n}` } });
    const page = (from: number, count: number): CloudChatPage => ({
      lines: Array.from({ length: count }, (_, i) => prompt(from + i)),
      next: from + count,
      source: 'browser',
      replies: [],
    });
    const { source } = sourceOf([page(0, CLOUD_CHAT_PAGE_LINES), page(CLOUD_CHAT_PAGE_LINES, 3)]);
    const drawn: number[] = [];
    chat.subscribe(() => drawn.push(chat.snapshot().turns.length));
    const feed = new CloudChatFeed(source, chat, {
      everyMs: 60_000,
      onPending: () => {},
      onReplyFailed: () => {},
    });
    const stop = feed.start();
    await vi.advanceTimersByTimeAsync(10);
    const turns = chat.snapshot().turns;
    expect(turns).toHaveLength(CLOUD_CHAT_PAGE_LINES + 3);
    expect(turns.at(-1)?.prompt?.text).toBe(`turn ${CLOUD_CHAT_PAGE_LINES + 2}`);
    // Never drawn half loaded, oldest turns first.
    expect(drawn.filter((count) => count > 0 && count < CLOUD_CHAT_PAGE_LINES + 3)).toEqual([]);
    stop();
  });

  it('reads the chat again from its start when lines land below what it read', async () => {
    // Regressions: the copy only grew at its end, so a log sent newest first
    // (its older stretches after) never reached a chat already open; and a
    // stretch that landed between lines read, with the copy's start unmoved,
    // was never drawn.
    vi.useFakeTimers();
    const chat = new SessionChat();
    const prompt = (uuid: string, text: string) =>
      line({ type: 'user', uuid, message: { role: 'user', content: text } });
    const { source } = sourceOf([
      // The log's first event and its newest, at places 0 and 3.
      {
        lines: [prompt('e1', 'Fix the login page'), prompt('e4', 'Also the signup page')],
        next: 4,
        held: 2,
        source: 'browser',
        replies: [],
      },
      // Places 1 and 2 landed below what was read: four held before 4.
      { lines: [], next: 4, held: 4, source: 'browser', replies: [] },
      {
        lines: [
          prompt('e1', 'Fix the login page'),
          prompt('e2', 'And its test'),
          prompt('e3', 'Then run it'),
          prompt('e4', 'Also the signup page'),
        ],
        next: 4,
        held: 4,
        source: 'browser',
        replies: [],
      },
    ]);
    const feed = new CloudChatFeed(source, chat, {
      everyMs: 1000,
      onPending: () => {},
      onReplyFailed: () => {},
    });
    const stop = feed.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(source.read).toHaveBeenNthCalledWith(1, null);
    expect(source.read).toHaveBeenNthCalledWith(2, 4);
    expect(source.read).toHaveBeenNthCalledWith(3, null);
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual([
      'Fix the login page',
      'And its test',
      'Then run it',
      'Also the signup page',
    ]);
    stop();
  });

  it('shows a reply the extension posted on claude.ai as sent until the log has its words', async () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const at = new Date('2026-11-27T10:00:00Z');
    const posted = {
      id: 'r1',
      text: 'Also the signup page',
      createdAt: at,
      collectedAt: at,
      deliveredVia: 'browser' as const,
    };
    // The extension posts a reply under the reply's own id, which the log keeps.
    const echo = line({
      type: 'user',
      uuid: 'r1',
      message: { role: 'user', content: 'Also the signup page' },
    });
    const { source } = sourceOf([
      { lines: [], next: 0, source: 'browser', replies: [posted] },
      { lines: [echo], next: 1, source: 'browser', replies: [posted] },
    ]);
    const pending: string[][] = [];
    const feed = new CloudChatFeed(source, chat, {
      everyMs: 1000,
      onPending: (now) => pending.push(now.map((reply) => `${reply.id}:${reply.state}`)),
      onReplyFailed: () => {},
    });
    const stop = feed.start();
    await vi.advanceTimersByTimeAsync(1000);
    // Breaks if the posted reply vanishes before the session has it, or stays
    // drawn beside the prompt it became.
    expect(pending).toEqual([['r1:sent'], []]);
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual([
      'Also the signup page',
    ]);
    stop();
  });

  it('never takes an earlier prompt with the same words for a reply the extension posted', async () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const claimed = new Date('2026-11-27T10:05:00Z');
    const posted = {
      id: 'r7',
      text: 'continue',
      createdAt: claimed,
      collectedAt: claimed,
      deliveredVia: 'browser' as const,
    };
    const earlier = line({
      type: 'user',
      uuid: 'old',
      timestamp: '2026-11-27T09:00:00Z',
      message: { role: 'user', content: 'continue' },
    });
    const later = line({
      type: 'user',
      uuid: 'claude-gave-it-another-id',
      timestamp: '2026-11-27T10:05:03Z',
      message: { role: 'user', content: 'continue' },
    });
    const { source } = sourceOf([
      { lines: [earlier], next: 1, source: 'browser', replies: [posted] },
      { lines: [later], next: 2, source: 'browser', replies: [posted] },
    ]);
    const pending: string[][] = [];
    const feed = new CloudChatFeed(source, chat, {
      everyMs: 1000,
      onPending: (now) => pending.push(now.map((reply) => `${reply.id}:${reply.state}`)),
      onReplyFailed: () => {},
    });
    const stop = feed.start();
    await vi.advanceTimersByTimeAsync(1000);
    // Breaks if an hour-old "continue" hides the new one as delivered, or if a
    // prompt with its words written after the claim does not count.
    expect(pending).toEqual([['r7:sent'], []]);
    stop();
  });
});
