import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import {
  BotConversationEntity,
  BotMessageEntity,
  BotTurnEntity,
  isSendingBotTurn,
} from '../../modules/bots';
import { useSendBotMessage, useSuspenseBotConversation } from '../bot-chat.queries';
import { fakeKernel } from './fake-kernel';

/**
 * Sending to a bot is optimistic: what you wrote is in the chat the moment
 * you send, not once the API answered and the chat was read again. What
 * breaks this: a send drawn only after its round trip (the chat sits empty
 * under "working"), a read landing while you wait taking it away, a send
 * drawn twice once stored, or a refused send left in the chat, or one that
 * takes what moved meanwhile with it.
 */

const CONVERSATION = ['bots', 'detail', 'bot-1', 'conversation'];
const at = new Date('2026-10-01T10:00:00Z');

function ended(...more: BotMessageEntity[]): BotConversationEntity {
  return new BotConversationEntity(
    [
      new BotMessageEntity('m1', 't1', 'user', 'Hi', [], at),
      new BotMessageEntity('m2', 't1', 'assistant', 'Hello', [], at),
      ...more,
    ],
    [new BotTurnEntity('t1', 'completed', 'anthropic', 'opus', null, 0, 0, false, at, at, at)],
    2 + more.length,
  );
}

function setup() {
  let answer!: { resolve: (turn: BotTurnEntity) => void; reject: (error: Error) => void };
  const sendMessage = vi.fn(
    () =>
      new Promise<BotTurnEntity>((resolve, reject) => {
        answer = { resolve, reject };
      }),
  );
  let stored = ended();
  const findConversation = vi.fn(async () => stored);
  const app = fakeKernel({ [TOKENS.BotsRepository]: { sendMessage, findConversation } });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(CONVERSATION, ended());
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  const onError = vi.fn();
  // The send beside the chat as the transcript reads it.
  const { result } = renderHook(
    () => ({
      send: useSendBotMessage({ onError }),
      chat: useSuspenseBotConversation('bot-1').data,
    }),
    { wrapper },
  );
  return {
    queryClient,
    sendMessage,
    onError,
    answer: () => answer,
    send: (content: string) => act(() => result.current.send.mutate({ id: 'bot-1', content })),
    chat: () => result.current.chat,
    /** What the API holds from now on, and a read of it landing. */
    land: async (next: BotConversationEntity) => {
      stored = next;
      await act(() => queryClient.refetchQueries({ queryKey: CONVERSATION }));
    },
  };
}

const contents = (conversation: BotConversationEntity) =>
  conversation.messages.map((message) => message.content);

describe('useSendBotMessage', () => {
  it('draws your message and its queued turn before the API answers', async () => {
    const { chat, send, sendMessage } = setup();

    send('Ship it');

    await waitFor(() => expect(contents(chat())).toEqual(['Hi', 'Hello', 'Ship it']));
    const turn = chat().activeTurn;
    expect(turn?.status).toBe('queued');
    expect(turn && isSendingBotTurn(turn.id)).toBe(true);
    // Drawn on the model the chat was on, so no "switched model" marker shows.
    expect(turn?.model).toBe('opus');
    expect(sendMessage).toHaveBeenCalledWith('bot-1', 'Ship it', undefined, undefined);
  });

  it('keeps your message through a read that lands while the API answers', async () => {
    const { chat, land, send } = setup();

    send('Ship it');
    await waitFor(() => expect(chat().messages).toHaveLength(3));
    await land(ended(new BotMessageEntity('m3', 't1', 'assistant', 'And done', [], at)));

    await waitFor(() => expect(contents(chat())).toEqual(['Hi', 'Hello', 'And done', 'Ship it']));
  });

  it('draws it once when that read already holds the stored message', async () => {
    const { chat, land, send } = setup();

    // Sent with the newline a paste ends in; the API stores it trimmed.
    send('Ship it\n');
    await waitFor(() => expect(chat().messages).toHaveLength(3));
    await land(ended(new BotMessageEntity('m3', 't2', 'user', 'Ship it', [], at)));

    await waitFor(() =>
      expect(chat().messages.map((message) => message.id)).toEqual(['m1', 'm2', 'm3']),
    );
  });

  it('takes only its own message out when the API refuses it, keeping what moved meanwhile', async () => {
    const { answer, chat, land, onError, send } = setup();

    send('Ship it');
    await waitFor(() => expect(chat().messages).toHaveLength(3));
    await land(ended(new BotMessageEntity('m3', 't1', 'assistant', 'And done', [], at)));
    act(() => answer().reject(new Error('BOTS_001')));

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(contents(chat())).toEqual(['Hi', 'Hello', 'And done']);
    expect(chat().activeTurn).toBeNull();
  });

  it('gives way to the stored message once the API has it, never off screen between', async () => {
    const { answer, chat, queryClient, send } = setup();
    const refetch = vi.spyOn(queryClient, 'invalidateQueries');

    send('Ship it');
    await waitFor(() => expect(answer()).toBeDefined());
    const stored = ended(new BotMessageEntity('m3', 't2', 'user', 'Ship it', [], at));
    refetch.mockImplementationOnce(async () => {
      // The send's entry is still laid over when the read lands.
      expect(contents(chat())).toContain('Ship it');
      queryClient.setQueryData(CONVERSATION, stored);
    });
    act(() =>
      answer().resolve(
        new BotTurnEntity('t2', 'queued', 'anthropic', 'opus', null, 0, 0, false, at, null, null),
      ),
    );

    await waitFor(() =>
      expect(chat().messages.map((message) => message.id)).toEqual(['m1', 'm2', 'm3']),
    );
    expect(refetch).toHaveBeenCalledWith({ queryKey: CONVERSATION });
  });
});
