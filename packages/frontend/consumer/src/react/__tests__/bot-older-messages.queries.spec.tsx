/**
 * A bot's chat scrolled up past its window, at the hooks the transcript
 * reads: `useSuspenseBotConversation` for what is drawn and
 * `useLoadOlderBotMessages` for the next page, over a fake repository that
 * pages a chat the way `GET /bots/:id/conversation` does (its keyset over a
 * real database is the API's integration suite). What breaks these: older
 * history that cannot be reached, a message drawn twice or out of order,
 * and history that vanishes or leaves a hole when the bot writes a window's
 * worth while the reader is up in it.
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
function setup(count: number) {
  const chat: BotMessageEntity[] = [];
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
          new Date(Date.UTC(2026, 9, 1, 0, index)),
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
    findConversation: async (_id: string, before?: string) =>
      pageOf(before ? chat.findIndex((message) => message.id === before) : chat.length),
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

  it('keeps the older pages under the window as the bot writes, with nothing lost between', async () => {
    const chat = setup(8);
    await waitFor(() => expect(chat.drawn()).toEqual(messages(5, 8)));
    await chat.scrollUp();

    // Less than a window: the window still meets the older pages.
    chat.write(2);
    await chat.readAgain();
    await waitFor(() => expect(chat.drawn()).toEqual(messages(2, 10)));

    // More than a window: the messages between are read too.
    chat.write(5);
    await chat.readAgain();
    await waitFor(() => expect(chat.drawn()).toEqual(messages(2, 15)));
    await chat.scrollUp();
    expect(chat.drawn()).toEqual(messages(0, 15));
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
