import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import type { BotStreamEvent, BotTurnStatus } from '@oppenheimer/shared/schemas/bot';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import {
  BotConversationEntity,
  BotMessageEntity,
  type BotStreamStatus,
  BotTurnEntity,
} from '../../modules/bots';
import { useBotLiveText } from '../bot-chat.queries';
import { fakeKernel } from './fake-kernel';

const CONVERSATION = ['bots', 'detail', 'bot-1', 'conversation'];
const APPROVALS = ['bots', 'detail', 'bot-1', 'approvals'];
const at = new Date('2026-10-01T10:00:00Z');

/** The conversation as a read returns it: turn `t1` in `status`, with these stored replies. */
function read(status: BotTurnStatus, ...replies: string[]): BotConversationEntity {
  return new BotConversationEntity(
    replies.map(
      (content, index) => new BotMessageEntity(`m${index}`, 't1', 'assistant', content, [], at),
    ),
    [new BotTurnEntity('t1', status, 'anthropic', 'm', null, 0, 0, false, at, at, null)],
    replies.length,
  );
}

/**
 * A bot stream the spec drives by hand. Reads never fetch: the spec records
 * what was invalidated and lands each read itself with `land`.
 */
function setup() {
  let status: (status: BotStreamStatus) => void = () => {};
  let event: (event: BotStreamEvent) => void = () => {};
  const order: string[] = [];
  const stream = {
    onStatus: (listener: typeof status) => {
      order.push('onStatus');
      status = listener;
      listener('down');
      return () => {};
    },
    onEvent: (listener: typeof event) => {
      order.push('onEvent');
      event = listener;
      return () => {};
    },
    open: vi.fn(() => order.push('open')),
    dispose: vi.fn(),
  };
  const openStream = vi.fn(() => stream);
  const findConversation = vi.fn(() => new Promise<never>(() => {}));
  const app = fakeKernel({ [TOKENS.BotsRepository]: { openStream, findConversation } });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(CONVERSATION, read('running'));
  const invalidated: unknown[][] = [];
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async (filters) => {
    invalidated.push([...(filters?.queryKey ?? [])]);
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
    order,
    openStream,
    wrapper,
    invalidated,
    status: (next: BotStreamStatus) => act(() => status(next)),
    send: (next: BotStreamEvent) => act(() => event(next)),
    /** A conversation read lands; the query cache tells its readers on the next tick. */
    land: (conversation: BotConversationEntity) =>
      act(async () => {
        queryClient.setQueryData(CONVERSATION, conversation);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }),
  };
}

const text = (value: string): BotStreamEvent => ({ type: 'text', turnId: 't1', text: value });

describe('useBotLiveText', () => {
  it('opens the bot’s stream once it listens, and closes it after', () => {
    const chat = setup();
    const { unmount } = renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    expect(chat.openStream).toHaveBeenCalledWith('bot-1');
    expect(chat.order).toEqual(['onStatus', 'onEvent', 'open']);
    unmount();
    expect(chat.stream.dispose).toHaveBeenCalled();
  });

  it('reads the conversation and the card again each time the stream comes up', async () => {
    const chat = setup();
    renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    await chat.status('live');
    await chat.status('down');
    await chat.status('live');
    expect(chat.invalidated).toEqual([CONVERSATION, APPROVALS, CONVERSATION, APPROVALS]);
  });

  it('reads the card again, and only the card, when one is raised or settled', async () => {
    const chat = setup();
    renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    await chat.send({ type: 'approval', approvalId: 'a1', status: 'pending' });
    expect(chat.invalidated).toEqual([APPROVALS]);
  });

  it('gathers a turn’s text as it streams', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    await chat.send(text('Hel'));
    await chat.send(text('lo'));
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
    await chat.send(text('First.'));
    await chat.send({ type: 'message', turnId: 't1', messageId: 'm0' });
    await chat.send(text(' Second'));
    expect(chat.invalidated).toEqual([CONVERSATION]);
    expect(result.current).toEqual({ t1: 'First. Second' });
    await chat.land(read('running', 'First.'));
    expect(result.current).toEqual({ t1: 'Second' });
  });

  /** Codex's finding: clearing on `ready` dropped a reply that had no stored message yet. */
  it('keeps a partial reply across a reconnect', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    await chat.status('live');
    await chat.send(text('Partial rep'));
    await chat.status('down');
    await chat.status('live');
    expect(result.current).toEqual({ t1: 'Partial rep' });
  });

  it('draws nothing of a turn once the read shows it ended, and reads the bot list again', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLiveText('bot-1'), { wrapper: chat.wrapper });
    await chat.send(text('Done'));
    await chat.send({ type: 'turn', turnId: 't1', status: 'completed' });
    expect(chat.invalidated).toContainEqual(['bots', 'list']);
    expect(chat.invalidated).toContainEqual(APPROVALS);
    expect(result.current).toEqual({ t1: 'Done' });
    await chat.land(read('completed', 'Done'));
    expect(result.current).toEqual({});
  });
});
