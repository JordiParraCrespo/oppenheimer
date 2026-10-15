import { randomUUID } from 'node:crypto';
import {
  type BotEngineEvent,
  type BotTurnRequest,
  FakeBotEngine,
} from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import type { BotTurnContextResolver } from '../../../application/bot-turn-context.resolver';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import { BotErrors } from '../../../domain/bots.errors';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { RunBotTurnCommand } from '../run-bot-turn.command';
import { RunBotTurnCommandHandler } from '../run-bot-turn.command-handler';

/**
 * Running one turn against a scripted engine: it is claimed before it runs and
 * a bot already busy leaves it queued; the bot's messages are stored and the
 * turn ends with the engine's outcome and usage; a failure in the engine or in
 * reading what the turn needs fails it with words; Stop aborts the engine; and
 * a turn found running is failed rather than run twice.
 */
function queued(status: 'queued' | 'running' = 'queued') {
  const turn = BotTurnEntity.queue({
    organizationId: randomUUID(),
    botId: randomUUID(),
    requestedByUserId: randomUUID(),
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
  });
  return status === 'running'
    ? BotTurnEntity.create({ id: turn.id, props: { ...turn.getProps(), status: 'running' } })
    : turn;
}

function setup(
  turn: BotTurnEntity | null,
  script: (request: BotTurnRequest) => AsyncIterable<BotEngineEvent> | BotEngineEvent[],
  options: { claim?: 'claimed' | 'busy' | 'lost'; cancel?: boolean; resolve?: Error } = {},
) {
  const turns = {
    findForRun: vi.fn(async () => (turn ? Some(turn) : None)),
    claim: vi.fn(async () => options.claim ?? 'claimed'),
    finish: vi.fn(async () => true),
    isCancelRequested: vi.fn(async () => options.cancel ?? false),
  } satisfies Partial<BotTurnRepositoryPort>;
  const messages = {
    findPrompt: vi.fn(async () => 'Hi'),
    insert: vi.fn(async () => undefined),
    saveSteps: vi.fn(async () => undefined),
  } satisfies Partial<BotMessageRepositoryPort>;
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const context = {
    resolve: vi.fn(async () => {
      if (options.resolve) throw options.resolve;
      return {
        provider: 'glm' as const,
        apiKey: 'key',
        model: 'glm-5.3',
        effort: null,
        systemPrompt: 'You are a bot.',
        history: [],
        message: 'Hi',
        tools: [],
      };
    }),
  };
  const handler = new RunBotTurnCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    messages as unknown as BotMessageRepositoryPort,
    stream,
    new FakeBotEngine(script),
    context as unknown as BotTurnContextResolver,
  );
  return { handler, turns, messages, stream };
}

const run = (handler: RunBotTurnCommandHandler, turnId: string) =>
  handler.execute(new RunBotTurnCommand({ turnId }));

describe('RunBotTurnCommandHandler', () => {
  it('claims the turn, stores the reply, and ends completed with its usage', async () => {
    const turn = queued();
    const { handler, turns, messages, stream } = setup(turn, () => [
      { type: 'text.delta', text: 'Hello' },
      { type: 'text.done', text: 'Hello' },
      { type: 'usage', inputTokens: 12, outputTokens: 3 },
      { type: 'done', reason: 'completed' },
    ]);
    await run(handler, turn.id);
    expect(turns.claim).toHaveBeenCalledTimes(1);
    expect(messages.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'assistant', content: 'Hello', position: 1 }),
    );
    expect(turn).toMatchObject({ status: 'completed', inputTokens: 12, outputTokens: 3 });
    expect(turns.finish).toHaveBeenCalledWith(turn, expect.any(String));
    expect(vi.mocked(stream.publish).mock.calls.map(([, event]) => event.type)).toEqual([
      'turn',
      'text',
      'message',
      'turn',
    ]);
  });

  it('leaves the turn queued, and runs nothing, when the bot is busy', async () => {
    const turn = queued();
    const script = vi.fn(() => [] as BotEngineEvent[]);
    const { handler, turns } = setup(turn, script, { claim: 'busy' });
    await run(handler, turn.id);
    expect(script).not.toHaveBeenCalled();
    expect(turns.finish).not.toHaveBeenCalled();
  });

  it('fails a turn found running, rather than running it twice', async () => {
    const turn = queued('running');
    const script = vi.fn(() => [] as BotEngineEvent[]);
    const { handler, turns } = setup(turn, script);
    await run(handler, turn.id);
    expect(script).not.toHaveBeenCalled();
    expect(turn).toMatchObject({ status: 'failed' });
    expect(turn.error).toMatch(/interrupted/);
    expect(turns.finish).toHaveBeenCalledTimes(1);
  });

  it('fails with the engine’s reason', async () => {
    const turn = queued();
    const { handler } = setup(turn, () => [{ type: 'done', reason: 'failed', error: 'bad key' }]);
    await run(handler, turn.id);
    expect(turn).toMatchObject({ status: 'failed', error: 'bad key' });
  });

  it('fails with the catalog’s words when the provider key is gone', async () => {
    const turn = queued();
    const { handler, messages } = setup(turn, () => [], {
      resolve: new AppError(BotErrors.PROVIDER_KEY_MISSING),
    });
    await run(handler, turn.id);
    expect(turn).toMatchObject({ status: 'failed', error: "The bot's model provider has no key" });
    expect(messages.insert).not.toHaveBeenCalled();
  });

  it('aborts the engine when Stop is pressed, and ends cancelled', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const turn = queued();
      const { handler } = setup(
        turn,
        (request) =>
          (async function* () {
            await new Promise<void>((resolve) =>
              request.signal.addEventListener('abort', () => resolve()),
            );
            yield { type: 'done', reason: 'cancelled' } as BotEngineEvent;
          })(),
        { cancel: true },
      );
      const done = run(handler, turn.id);
      await vi.advanceTimersByTimeAsync(1_000);
      await done;
      expect(turn).toMatchObject({ status: 'cancelled', error: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing for a turn that is gone or already ended', async () => {
    const ended = queued();
    ended.end('cancelled', new Date());
    for (const turn of [null, ended]) {
      const { handler, turns } = setup(turn, () => []);
      await run(handler, turn?.id ?? randomUUID());
      expect(turns.claim).not.toHaveBeenCalled();
      expect(turns.finish).not.toHaveBeenCalled();
    }
  });
});
