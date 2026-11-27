import { CLOUD_REPLY_PREAMBLE } from '@oppenheimer/shared/schemas/session-cloud-chat';
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
    expect(source.read).toHaveBeenNthCalledWith(3, 0);
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual([
      'Fix the login page',
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
    const echo = line({
      type: 'user',
      uuid: 'e9',
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
});
