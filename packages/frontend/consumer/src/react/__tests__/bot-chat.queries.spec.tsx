import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import type { BotStreamEvent } from '@oppenheimer/shared/schemas/bot';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { BotStreamStatus } from '../../modules/bots';
import { useBotLiveText } from '../bot-chat.queries';
import { fakeKernel } from './fake-kernel';

/** A bot stream the spec drives by hand, and a conversation read the spec settles by hand. */
function setup() {
  let status: (status: BotStreamStatus) => void = () => {};
  let event: (event: BotStreamEvent) => void = () => {};
  const stream = {
    onStatus: (listener: typeof status) => {
      status = listener;
      listener('down');
      return () => {};
    },
    onEvent: (listener: typeof event) => {
      event = listener;
      return () => {};
    },
    dispose: vi.fn(),
  };
  const openStream = vi.fn(() => stream);
  const app = fakeKernel({ [TOKENS.BotsRepository]: { openStream } });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const reads: (() => void)[] = [];
  const invalidated: unknown[][] = [];
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters) => {
    invalidated.push([...(filters?.queryKey ?? [])]);
    return new Promise<void>((resolve) => reads.push(resolve));
  });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return {
    stream,
    openStream,
    wrapper,
    invalidated,
    status: (next: BotStreamStatus) => act(() => status(next)),
    send: (next: BotStreamEvent) => act(() => event(next)),
    /** Every conversation read asked for so far comes back. */
    settle: () =>
      act(async () => {
        for (const resolve of reads.splice(0)) resolve();
      }),
  };
}

const text = (turnId: string, value: string): BotStreamEvent => ({
  type: 'text',
  turnId,
  text: value,
});

describe('useBotLiveText', () => {
  it('opens the bot’s stream while mounted, and closes it after', () => {
    const chat = setup();
    const { unmount } = renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    expect(chat.openStream).toHaveBeenCalledWith('bot-1');
    unmount();
    expect(chat.stream.dispose).toHaveBeenCalled();
  });

  it('reads the conversation again each time the stream comes up', async () => {
    const chat = setup();
    renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    await chat.status('live');
    expect(chat.invalidated).toEqual([['bots', 'detail', 'bot-1', 'conversation']]);
  });

  it('gathers a turn’s text as it streams', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    await chat.send(text('t1', 'Hel'));
    await chat.send(text('t1', 'lo'));
    expect(result.current).toEqual({ t1: 'Hello' });
  });

  /**
   * The regression this guards: text stored as a message was drawn twice,
   * once from the conversation and once still live; or dropped before the
   * read that holds it landed, so it blinked out.
   */
  it('keeps text live until the read that stores it lands, then only what came after', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    await chat.send(text('t1', 'First.'));
    await chat.send({ type: 'message', turnId: 't1', messageId: 'm1' });
    await chat.send(text('t1', ' Second'));
    expect(result.current).toEqual({ t1: 'First. Second' });
    await chat.settle();
    expect(result.current).toEqual({ t1: ' Second' });
  });

  it('forgets a turn once it has ended and its read has landed, and reads the bot list again', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    await chat.send(text('t1', 'Done'));
    await chat.send({ type: 'turn', turnId: 't1', status: 'completed' });
    expect(chat.invalidated).toContainEqual(['bots', 'list']);
    await chat.settle();
    expect(result.current).toEqual({});
  });
});
