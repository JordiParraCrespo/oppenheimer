import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import type {
  BotStreamEvent,
  BotSubagentProgress,
  BotTurnStatus,
} from '@oppenheimer/shared/schemas/bot';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import {
  BotConversationEntity,
  BotMessageEntity,
  type BotStreamStatus,
  BotTurnEntity,
} from '../../modules/bots';
import { BotApprovalEntity } from '../../modules/bots/bot-conversation.entity';
import { useBotLive } from '../bot-chat.queries';
import { fakeKernel } from './fake-kernel';

const CONVERSATION = ['bots', 'detail', 'bot-1', 'conversation'];
const APPROVALS = ['bots', 'detail', 'bot-1', 'approvals'];
const GOAL = ['bots', 'detail', 'bot-1', 'goal'];
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
    queryClient,
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

/** A `delegate` call's frame: one child, in `state`, having called `tools`. */
const frame = (state: BotSubagentProgress['state'], ...tools: string[]): BotStreamEvent => ({
  type: 'subagents',
  turnId: 't1',
  callId: 'c1',
  runs: [{ task: 'Check #12', state, toolCalls: tools, startedAt: null, durationMs: null }],
});

/** The read where turn `t1`'s `delegate` call `c1` has ended and is stored. */
function delegated(status: BotTurnStatus): BotConversationEntity {
  const step = {
    callId: 'c1',
    name: 'delegate',
    input: {},
    output: '1 subagent ran',
    isError: false,
    sessionId: null,
    subagents: [],
    allowedBy: null,
    mailDraft: null,
  };
  return new BotConversationEntity(
    [new BotMessageEntity('m0', 't1', 'activity', '', [step], at)],
    [new BotTurnEntity('t1', status, 'anthropic', 'm', null, 0, 0, false, at, at, null)],
    1,
  );
}

describe('useBotLive', () => {
  it('opens the bot’s stream once it listens, and closes it after', () => {
    const chat = setup();
    const { unmount } = renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
    expect(chat.openStream).toHaveBeenCalledWith('bot-1');
    expect(chat.order).toEqual(['onStatus', 'onEvent', 'open']);
    unmount();
    expect(chat.stream.dispose).toHaveBeenCalled();
  });

  it('reads the conversation, the goal and the card again each time the stream comes up', async () => {
    const chat = setup();
    renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
    await chat.status('live');
    await chat.status('down');
    await chat.status('live');
    expect(chat.invalidated).toEqual([
      CONVERSATION,
      GOAL,
      APPROVALS,
      CONVERSATION,
      GOAL,
      APPROVALS,
    ]);
  });

  it('reads the card again, and only the card, when one is raised or settled', async () => {
    const chat = setup();
    renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
    await chat.send({ type: 'approval', approvalId: 'a1', status: 'pending' });
    expect(chat.invalidated).toEqual([APPROVALS]);
  });

  it('gathers a turn’s text as it streams', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
    await chat.send(text('Hel'));
    await chat.send(text('lo'));
    expect(result.current.text).toEqual({ t1: 'Hello' });
  });

  /**
   * The regression this guards: text stored as a message was drawn twice,
   * once from the conversation and once still live; or dropped before the
   * read that holds it landed, so it blinked out.
   */
  it('keeps text live until the read that stores it lands, then only what came after', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
    await chat.send(text('First.'));
    await chat.send({ type: 'message', turnId: 't1', messageId: 'm0' });
    await chat.send(text(' Second'));
    expect(chat.invalidated).toEqual([CONVERSATION, GOAL]);
    expect(result.current.text).toEqual({ t1: 'First. Second' });
    await chat.land(read('running', 'First.'));
    expect(result.current.text).toEqual({ t1: 'Second' });
  });

  /** Codex's finding: clearing on `ready` dropped a reply that had no stored message yet. */
  it('keeps a partial reply across a reconnect', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
    await chat.status('live');
    await chat.send(text('Partial rep'));
    await chat.status('down');
    await chat.status('live');
    expect(result.current.text).toEqual({ t1: 'Partial rep' });
  });

  // What breaks this: a turn that waited once still saying "retrying" after
  // it wrote again, or after it ended.
  it('says a turn waits on its provider until it writes again or ends', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
    await chat.send({ type: 'retrying', turnId: 't1', reason: 'rate_limit' });
    expect(result.current.retrying).toEqual({ t1: 'rate_limit' });
    expect(chat.invalidated).toEqual([]);
    await chat.send(text('Back'));
    expect(result.current.retrying).toEqual({});

    await chat.send({ type: 'retrying', turnId: 't1', reason: 'unavailable' });
    await chat.land(read('failed'));
    expect(result.current.retrying).toEqual({});
  });

  it('draws nothing of a turn once the read shows it ended, and reads the bot list again', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
    await chat.send(text('Done'));
    await chat.send({ type: 'turn', turnId: 't1', status: 'completed' });
    expect(chat.invalidated).toContainEqual(['bots', 'list']);
    expect(chat.invalidated).toContainEqual(APPROVALS);
    expect(result.current.text).toEqual({ t1: 'Done' });
    await chat.land(read('completed', 'Done'));
    expect(result.current.text).toEqual({});
  });

  it('shows a running delegate call’s children as the newest frame says, without reading the conversation', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
    await chat.send(frame('queued'));
    await chat.send(frame('running', 'list_hosts', 'get_pull_request'));
    expect(chat.invalidated).toEqual([]);
    expect(result.current.subagents.c1?.map((run) => [run.state, run.toolCalls])).toEqual([
      ['running', ['list_hosts', 'get_pull_request']],
    ]);
  });

  /** The regression this guards: a call's live children drawn beside its stored runs once it ended. */
  it('steps aside for the stored runs once the call’s step lands with its output', async () => {
    const chat = setup();
    const { result } = renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
    await chat.send(frame('completed', 'list_hosts'));
    expect(Object.keys(result.current.subagents)).toEqual(['c1']);
    await chat.land(delegated('running'));
    expect(result.current.subagents).toEqual({});
  });

  describe('Needs input cards', () => {
    const PENDING = [...APPROVALS, 'pending'];
    afterEach(() => vi.useRealTimers());

    it('takes down a card another tab decided at once, and draws its line until the stored one lands', async () => {
      const chat = setup();
      const card = new BotApprovalEntity('a1', 't1', 'start_session', 'Start', 'pending', null, at);
      chat.queryClient.setQueryData(PENDING, card);
      const { result } = renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
      await chat.send({
        type: 'approval_resolved',
        approvalId: 'a1',
        outcome: 'stopped',
        tool: 'start_session',
        summary: 'Start',
      });
      expect(chat.queryClient.getQueryData(PENDING)).toBeNull();
      expect(result.current.resolved).toMatchObject([{ outcome: 'stopped', approvalId: 'a1' }]);
      const line = new BotMessageEntity('m9', null, 'event', 'You stopped', [], at, {
        kind: 'approval',
        outcome: 'stopped',
        tool: 'start_session',
        summary: 'Start',
        sessionId: null,
        approvalId: 'a1',
      });
      await chat.land(new BotConversationEntity([line], [], 1));
      expect(result.current.resolved).toEqual([]);
    });

    it('reads a card raised mid-sentence only once the line ends', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const chat = setup();
      renderHook(() => useBotLive('bot-1'), { wrapper: chat.wrapper });
      await chat.send(text('I will start a ses'));
      await chat.send({ type: 'approval', approvalId: 'a1', status: 'pending' });
      expect(chat.invalidated).toEqual([]);
      await chat.send(text('sion.\n'));
      expect(chat.invalidated).toEqual([APPROVALS]);
    });
  });
});
