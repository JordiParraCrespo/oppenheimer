import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { BotTurnEntity } from '../../modules/bots';
import { useSendBotMessage } from '../bot-chat.queries';
import { useBotSuggestion } from '../bot-suggestion.queries';
import { fakeKernel } from './fake-kernel';

/**
 * The composer's suggestion answers the bot's last words, so a send takes it
 * away. What breaks this: a suggestion read still in flight when you send
 * landing afterwards and putting the old guess back, to be shown (and taken
 * with Tab) beside the bot's next answer.
 */

const at = new Date('2026-10-01T10:00:00Z');

function setup() {
  // Each read's answer, in the order asked; a read after the send is the bot's next words', none yet.
  const reads: ((suggestion: string | null) => void)[] = [];
  const findSuggestion = vi.fn(
    () =>
      new Promise<string | null>((resolve) => {
        reads.push(resolve);
      }),
  );
  // The send waits on the API until `accept`: the window a stale read can land in.
  let accept!: () => void;
  const sendMessage = vi.fn(
    () =>
      new Promise<BotTurnEntity>((resolve) => {
        accept = () =>
          resolve(
            new BotTurnEntity(
              't2',
              'queued',
              'anthropic',
              'opus',
              null,
              0,
              0,
              false,
              at,
              null,
              null,
            ),
          );
      }),
  );
  const app = fakeKernel({
    [TOKENS.BotsRepository]: { findSuggestion, sendMessage, findConversation: vi.fn() },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  const { result } = renderHook(
    () => ({ send: useSendBotMessage(), suggestion: useBotSuggestion('bot-1', true) }),
    { wrapper },
  );
  return {
    result,
    findSuggestion,
    /** The first read, asked before the send, answers at last. */
    landStale: (suggestion: string) => reads[0](suggestion),
    /** The API takes the send. */
    accept: () => accept(),
    /** Every later read answers that there is nothing to suggest yet. */
    settleLater: () => {
      for (const resolve of reads.slice(1)) resolve(null);
    },
  };
}

describe('useBotSuggestion beside a send', () => {
  it('keeps a read in flight when you send from bringing the old guess back', async () => {
    const { result, findSuggestion, landStale, accept, settleLater } = setup();
    await waitFor(() => expect(findSuggestion).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.send.mutate({ id: 'bot-1', content: 'deploy it' });
    });
    await act(async () => landStale('yes, open the pull request'));
    // The read after the send asks a model and takes seconds: the stale guess must not show meanwhile.
    await act(async () => accept());
    expect(result.current.suggestion).toBeNull();

    await act(async () => settleLater());
    expect(result.current.suggestion).toBeNull();
  });
});
