/**
 * A loop's run came due (`25-bots.md` §4.1, `/loop`). What breaks this: a job
 * for a run that was already queued, or moved by the bot, queuing a second
 * one; an expired loop running once more instead of ending; a run queued for
 * an owner who left the workspace; a run queued with the wrong key or apart
 * from the loop's next run (the repository claims both at once:
 * `enqueueLoopRun`). Whether a busy bot skips is the repository's, under its
 * lock (the integration suite).
 */
import type { BotLoopResolver } from '../../../application/bot-loop.resolver';
import type { BotLoopRepositoryPort } from '../../../database/bot-loop.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotLoopEntity } from '../../../domain/bot-loop.entity';
import { loopSourceKey } from '../../../domain/bot-loop.policy';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { RunBotLoopCommand } from '../run-bot-loop.command';
import { RunBotLoopCommandHandler } from '../run-bot-loop.command-handler';

const PROPS = {
  organizationId: 'org-1',
  botId: 'bot-1',
  requestedByUserId: 'owner-1',
  provider: 'anthropic' as const,
  model: 'claude-sonnet-5-5',
  effort: null,
  timeZone: 'Europe/Madrid',
  credentialScopes: ['bots:read' as const],
};

function loop(nextRunAt: Date, expiresAt = new Date(Date.now() + 86_400_000)): BotLoopEntity {
  return BotLoopEntity.create({
    id: 'loop-1',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      prompt: 'check the deploy',
      intervalMinutes: 5,
      runs: 0,
      nextRunAt,
      expiresAt,
      credentialScopes: ['bots:read'],
      timeZone: 'Europe/Madrid',
    },
  });
}

function setup(stored: BotLoopEntity | null, owned = true) {
  const loops = { findForRun: vi.fn(async () => stored) } satisfies Partial<BotLoopRepositoryPort>;
  const turns = {
    enqueueLoopRun: vi.fn<BotTurnRepositoryPort['enqueueLoopRun']>(async () => 'staged'),
  };
  const stream = { publish: vi.fn(async () => undefined) };
  const loopsOf = {
    end: vi.fn(async () => true),
    runProps: vi.fn(async () => (owned ? PROPS : null)),
  };
  const handler = new RunBotLoopCommandHandler(
    loops as unknown as BotLoopRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    stream as unknown as BotStreamPort,
    loopsOf as unknown as BotLoopResolver,
  );
  return { handler, turns, stream, loopsOf };
}

const due = (at: Date, run = 1) =>
  new RunBotLoopCommand({ loopId: 'loop-1', run, at, metadata: { correlationId: 'c-1' } });

describe('RunBotLoopCommandHandler', () => {
  it('queues the run as the owner, keyed by the loop and its count, with the next one due an interval on', async () => {
    const at = new Date(Date.now() - 1_000);
    const { handler, turns, stream } = setup(loop(at));
    await handler.execute(due(at));
    const [turn, opening, , , times] = vi.mocked(turns.enqueueLoopRun).mock.calls[0];
    expect(turn).toMatchObject({
      origin: 'loop',
      sourceKey: loopSourceKey('loop-1', 1),
      requestedByUserId: 'owner-1',
      credentialScopes: ['bots:read'],
    });
    expect(opening.event).toMatchObject({ kind: 'loop', activity: 'ran', run: 2 });
    expect(times.next?.getTime()).toBe(at.getTime() + 5 * 60_000);
    expect(stream.publish).toHaveBeenCalledWith('bot-1', expect.objectContaining({ type: 'turn' }));
  });

  it('does nothing for a job that is not the next run any more, nor for a loop gone', async () => {
    const at = new Date(Date.now() - 1_000);
    const moved = setup(loop(new Date(at.getTime() + 60_000)));
    await moved.handler.execute(due(at));
    await moved.handler.execute(due(at, 2));
    const gone = setup(null);
    await gone.handler.execute(due(at));
    expect(moved.turns.enqueueLoopRun).not.toHaveBeenCalled();
    expect(gone.turns.enqueueLoopRun).not.toHaveBeenCalled();
    expect(moved.loopsOf.end).not.toHaveBeenCalled();
  });

  it('ends an expired loop with its line instead of running it', async () => {
    const at = new Date(Date.now() - 1_000);
    const { handler, turns, loopsOf } = setup(loop(at, at));
    await handler.execute(due(at));
    expect(loopsOf.end).toHaveBeenCalledWith(
      expect.anything(),
      { activity: 'expired', reason: null },
      'c-1',
    );
    expect(turns.enqueueLoopRun).not.toHaveBeenCalled();
  });

  it('stops the loop of an owner who can no longer act in the workspace', async () => {
    const at = new Date(Date.now() - 1_000);
    const { handler, turns, loopsOf } = setup(loop(at), false);
    await handler.execute(due(at));
    expect(loopsOf.end).toHaveBeenCalledWith(
      expect.anything(),
      { activity: 'stopped', reason: 'access_lost' },
      'c-1',
    );
    expect(turns.enqueueLoopRun).not.toHaveBeenCalled();
  });
});
