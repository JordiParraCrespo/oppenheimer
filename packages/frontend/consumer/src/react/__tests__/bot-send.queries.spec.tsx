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
import { useSendBotMessage } from '../bot-chat.queries';
import { fakeKernel } from './fake-kernel';

/**
 * Sending to a bot is optimistic: what you wrote is in the chat the moment
 * you send, not once the API answered and the chat was read again. What
 * breaks this: a send drawn only after its round trip (the chat sits empty
 * under "working"), or a refused send left in the chat as if it were sent.
 */

const CONVERSATION = ['bots', 'detail', 'bot-1', 'conversation'];
const at = new Date('2026-10-01T10:00:00Z');

function ended(): BotConversationEntity {
  return new BotConversationEntity(
    [
      new BotMessageEntity('m1', 't1', 'user', 'Hi', [], at),
      new BotMessageEntity('m2', 't1', 'assistant', 'Hello', [], at),
    ],
    [new BotTurnEntity('t1', 'completed', 'anthropic', 'opus', null, 0, 0, false, at, at, at)],
    2,
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
  const findConversation = vi.fn(() => new Promise<never>(() => {}));
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
  const conversation = () => queryClient.getQueryData<BotConversationEntity>(CONVERSATION);
  return { queryClient, sendMessage, answer: () => answer, conversation, wrapper };
}

describe('useSendBotMessage', () => {
  it('draws your message and its queued turn before the API answers', async () => {
    const { conversation, sendMessage, wrapper } = setup();
    const { result } = renderHook(() => useSendBotMessage(), { wrapper });

    act(() => result.current.mutate({ id: 'bot-1', content: 'Ship it' }));

    await waitFor(() => expect(conversation()?.messages).toHaveLength(3));
    const sent = conversation()?.messages.at(-1);
    expect(sent?.role).toBe('user');
    expect(sent?.content).toBe('Ship it');
    const turn = conversation()?.activeTurn;
    expect(turn?.status).toBe('queued');
    expect(turn && isSendingBotTurn(turn.id)).toBe(true);
    // Drawn on the model the chat was on, so no "switched model" marker shows.
    expect(turn?.model).toBe('opus');
    expect(sendMessage).toHaveBeenCalledWith('bot-1', 'Ship it', undefined, undefined);
  });

  it('takes the message back out when the API refuses it', async () => {
    const { answer, conversation, wrapper } = setup();
    const before = conversation();
    const onError = vi.fn();
    const { result } = renderHook(() => useSendBotMessage({ onError }), { wrapper });

    act(() => result.current.mutate({ id: 'bot-1', content: 'Ship it' }));
    await waitFor(() => expect(conversation()?.messages).toHaveLength(3));
    act(() => answer().reject(new Error('BOTS_001')));

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(conversation()).toBe(before);
  });

  it('reads the chat again once the API has stored it', async () => {
    const { answer, queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSendBotMessage(), { wrapper });

    act(() => result.current.mutate({ id: 'bot-1', content: 'Ship it' }));
    await waitFor(() => expect(answer()).toBeDefined());
    act(() =>
      answer().resolve(
        new BotTurnEntity('t2', 'queued', 'anthropic', 'opus', null, 0, 0, false, at, null, null),
      ),
    );

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: CONVERSATION }));
  });
});
