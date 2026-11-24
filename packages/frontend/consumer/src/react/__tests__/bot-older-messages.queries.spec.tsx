/**
 * A bot's chat scrolled up past its window, at the hooks the transcript
 * reads: `useSuspenseBotConversation` for what is drawn and
 * `useLoadOlderBotMessages` for the next page, over a fake repository that
 * pages a chat the way `GET /bots/:id/conversation` does (its keyset over a
 * real database is the API's integration suite). What breaks these: older
 * history that cannot be reached, a message drawn twice or out of order,
 * history that vanishes or leaves a hole when the bot writes while the
 * reader is up in it (a message beside the boundary in the same millisecond
 * included), and new messages held back by a read of older ones.
 */
import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { BotConversationEntity, BotMessageEntity } from '../../modules/bots';
import { useLoadOlderBotMessages, useSuspenseBotConversation } from '../bot-chat.queries';
import { useReactToBotMessage } from '../bot-reactions.queries';
import { botsKeys } from '../bots.keys';
import { fakeKernel } from './fake-kernel';

/** How many messages a read holds, the API's `limit` made small. */
const PAGE = 3;

/** A chat the spec writes to, read a page at a time as the API reads it. */
function setup(count: number, { sameTime = false } = {}) {
  const chat: BotMessageEntity[] = [];
  /** The reads of an older page, by the message each ended before. */
  const before: string[] = [];
  let olderFails = false;
  let olderGate: Promise<void> | null = null;
  const write = (n: number) => {
    for (let i = 0; i < n; i += 1) {
      const index = chat.length;
      chat.push(
        new BotMessageEntity(
          `m${index}`,
          null,
          'user',
          `Message ${index}`,
          [],
          new Date(Date.UTC(2026, 9, 1, 0, sameTime ? 0 : index)),
        ),
      );
    }
  };
  write(count);
  const pageOf = (end: number) => {
    const start = Math.max(0, end - PAGE);
    return new BotConversationEntity(chat.slice(start, end), [], chat.length, {}, start > 0);
  };
  const repository = {
    findConversation: async (_id: string, cursor?: string) => {
      if (!cursor) return pageOf(chat.length);
      before.push(cursor);
      if (olderGate) await olderGate;
      if (olderFails) throw new Error('older page refused');
      return pageOf(chat.findIndex((message) => message.id === cursor));
    },
    react: async () => chat[0],
  };
  const app = fakeKernel({ [TOKENS.BotsRepository]: repository });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>
          <Suspense>{children}</Suspense>
        </OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  const { result } = renderHook(
    () => ({
      chat: useSuspenseBotConversation('bot-1').data,
      older: useLoadOlderBotMessages('bot-1'),
      react: useReactToBotMessage(),
    }),
    { wrapper },
  );
  return {
    result,
    write,
    before,
    failOlder: (fails: boolean) => {
      olderFails = fails;
    },
    /** Holds every older read until the returned function lets them go. */
    holdOlder: () => {
      let release = () => {};
      olderGate = new Promise<void>((resolve) => {
        release = () => {
          olderGate = null;
          resolve();
        };
      });
      return release;
    },
    /** What the chat draws, oldest first. */
    drawn: () => result.current.chat.messages.map((message) => message.content),
    scrollUp: async () => {
      await act(async () => result.current.older.loadOlder());
      await waitFor(() => expect(result.current.older.isPending).toBe(false));
    },
    /** The bot wrote; the chat is read again, as a stored message makes it. */
    readAgain: () =>
      act(() => queryClient.invalidateQueries({ queryKey: botsKeys.conversation('bot-1') })),
  };
}

const messages = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, index) => `Message ${from + index}`);

describe('a bot chat scrolled up past its window', () => {
  it('reads older pages one at a time until the first message, each once, oldest first', async () => {
    const chat = setup(8);
    await waitFor(() => expect(chat.drawn()).toEqual(messages(5, 8)));
    expect(chat.result.current.chat.hasOlder).toBe(true);

    await chat.scrollUp();
    expect(chat.drawn()).toEqual(messages(2, 8));
    await chat.scrollUp();
    expect(chat.drawn()).toEqual(messages(0, 8));
    expect(chat.result.current.chat.hasOlder).toBe(false);

    // Past the first message, there is nothing to read.
    await chat.scrollUp();
    expect(chat.drawn()).toEqual(messages(0, 8));
  });

  it('keeps the older pages under the window as the bot writes, reading nothing again', async () => {
    const chat = setup(8);
    await waitFor(() => expect(chat.drawn()).toEqual(messages(5, 8)));
    await chat.scrollUp();
    expect(chat.before).toEqual(['m5']);

    for (const written of [9, 10, 11, 12]) {
      chat.write(1);
      await chat.readAgain();
      await waitFor(() => expect(chat.drawn()).toEqual(messages(2, written)));
    }
    expect(chat.before).toEqual(['m5']);
    await chat.scrollUp();
    expect(chat.drawn()).toEqual(messages(0, 12));
  });

  it('reads the messages between when the window moved past all it held, one beside the boundary in the same millisecond included', async () => {
    const chat = setup(8, { sameTime: true });
    await waitFor(() => expect(chat.drawn()).toEqual(messages(5, 8)));
    await chat.scrollUp();

    chat.write(5);
    await chat.readAgain();
    await waitFor(() => expect(chat.drawn()).toEqual(messages(2, 13)));
  });

  it('keeps the older pages drawn while the messages between are read, then joins them', async () => {
    const chat = setup(8);
    await waitFor(() => expect(chat.drawn()).toEqual(messages(5, 8)));
    await chat.scrollUp();

    const release = chat.holdOlder();
    chat.write(5);
    await chat.readAgain();
    await waitFor(() => expect(chat.drawn()).toEqual([...messages(2, 5), ...messages(10, 13)]));
    await act(async () => release());
    await waitFor(() => expect(chat.drawn()).toEqual(messages(2, 13)));
  });

  it('joins the older pages when a page is loaded while the messages between are still out', async () => {
    const chat = setup(8);
    await waitFor(() => expect(chat.drawn()).toEqual(messages(5, 8)));
    await chat.scrollUp();

    const release = chat.holdOlder();
    chat.write(5);
    await chat.readAgain();
    await waitFor(() => expect(chat.drawn()).toEqual([...messages(2, 5), ...messages(10, 13)]));
    act(() => chat.result.current.older.loadOlder());
    await act(async () => release());
    await waitFor(() => expect(chat.result.current.older.isPending).toBe(false));
    await waitFor(() => expect(chat.drawn()).toEqual(messages(0, 13)));
  });

  it('lets the older pages go when the read between fails, and draws the newest messages', async () => {
    const chat = setup(8);
    await waitFor(() => expect(chat.drawn()).toEqual(messages(5, 8)));
    await chat.scrollUp();

    chat.failOlder(true);
    chat.write(5);
    await chat.readAgain();
    await waitFor(() => expect(chat.drawn()).toEqual(messages(10, 13)));
    expect(chat.result.current.chat.hasOlder).toBe(true);

    chat.failOlder(false);
    await chat.scrollUp();
    expect(chat.drawn()).toEqual(messages(7, 13));
  });

  it('keeps the message the window let go while the first older page was out', async () => {
    const chat = setup(8);
    await waitFor(() => expect(chat.drawn()).toEqual(messages(5, 8)));
    const release = chat.holdOlder();
    act(() => chat.result.current.older.loadOlder());
    await waitFor(() => expect(chat.before).toEqual(['m5']));

    chat.write(1);
    await chat.readAgain();
    await waitFor(() => expect(chat.drawn()).toEqual(messages(6, 9)));
    await act(async () => release());
    await waitFor(() => expect(chat.drawn()).toEqual(messages(2, 9)));
  });

  it('shows your reaction on a message in the older pages', async () => {
    const chat = setup(5);
    await waitFor(() => expect(chat.drawn()).toEqual(messages(2, 5)));
    await chat.scrollUp();
    await act(async () =>
      chat.result.current.react.mutate({ id: 'bot-1', messageId: 'm0', emoji: '👍' }),
    );
    await waitFor(() => expect(chat.result.current.chat.messages[0]?.reaction).toBe('👍'));
  });
});
