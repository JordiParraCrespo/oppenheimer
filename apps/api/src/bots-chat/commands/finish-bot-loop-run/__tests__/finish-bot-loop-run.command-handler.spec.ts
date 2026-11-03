/**
 * A run of a loop ended (`25-bots.md` §4.1, `/loop`). What breaks this: a
 * loop going on after its run was stopped or failed for good; a self-paced
 * loop going on with nobody saying when, or ending over a passing failure;
 * another turn's end touching the loop. The decision table itself is
 * `bot-loop.policy.spec.ts`; this proves the handler acts on it.
 */
import { Some } from 'oxide.ts';
import type { BotLoopResolver } from '../../../application/bot-loop.resolver';
import type { BotLoopRepositoryPort } from '../../../database/bot-loop.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotLoopEntity } from '../../../domain/bot-loop.entity';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import { FinishBotLoopRunCommand } from '../finish-bot-loop-run.command';
import { FinishBotLoopRunCommandHandler } from '../finish-bot-loop-run.command-handler';

const PROPS = {
  organizationId: 'org-1',
  botId: 'bot-1',
  requestedByUserId: 'owner-1',
  provider: 'anthropic' as const,
  model: 'claude-sonnet-5-5',
  effort: null,
};

function loop(intervalMinutes: number | null, nextRunAt: Date | null): BotLoopEntity {
  return BotLoopEntity.create({
    id: 'loop-1',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      prompt: 'watch PR 42',
      intervalMinutes,
      runs: 1,
      nextRunAt,
      expiresAt: new Date(Date.now() + 86_400_000),
      credentialScopes: null,
      timeZone: null,
    },
  });
}

function run(status: 'completed' | 'failed' | 'cancelled', failure?: 'rate_limit'): BotTurnEntity {
  const turn = BotTurnEntity.queue({ ...PROPS, origin: 'loop', sourceKey: 'loop:loop-1:1' });
  turn.end(
    status,
    new Date(),
    status === 'failed' ? { error: 'boom', failure: failure ?? 'other' } : {},
  );
  return turn;
}

function setup(stored: BotLoopEntity | null, turn: BotTurnEntity) {
  const turns = { findForRun: vi.fn(async () => Some(turn)) };
  const loops = {
    findForBot: vi.fn(async () => stored),
    schedule: vi.fn<BotLoopRepositoryPort['schedule']>(async () => true),
  };
  const loopsOf = { end: vi.fn(async () => true) };
  const handler = new FinishBotLoopRunCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    loops as unknown as BotLoopRepositoryPort,
    loopsOf as unknown as BotLoopResolver,
  );
  return { handler, loops, loopsOf };
}

const finish = (turn: BotTurnEntity) =>
  new FinishBotLoopRunCommand({ turnId: turn.id, metadata: { correlationId: 'c-1' } });

describe('FinishBotLoopRunCommandHandler', () => {
  it('stops the loop when the person stopped its run', async () => {
    const turn = run('cancelled');
    const { handler, loopsOf } = setup(loop(5, new Date()), turn);
    await handler.execute(finish(turn));
    expect(loopsOf.end).toHaveBeenCalledWith(
      expect.anything(),
      { activity: 'stopped', reason: 'cancelled' },
      'c-1',
    );
  });

  it('leaves a fixed loop whose run went as it should to its next run, already staged', async () => {
    const turn = run('completed');
    const { handler, loops, loopsOf } = setup(loop(5, new Date()), turn);
    await handler.execute(finish(turn));
    expect(loopsOf.end).not.toHaveBeenCalled();
    expect(loops.schedule).not.toHaveBeenCalled();
  });

  it('ends a self-paced loop whose run did not say when to run next', async () => {
    const turn = run('completed');
    const { handler, loopsOf } = setup(loop(null, null), turn);
    await handler.execute(finish(turn));
    expect(loopsOf.end).toHaveBeenCalledWith(
      expect.anything(),
      { activity: 'ended', reason: null },
      'c-1',
    );
  });

  it('tries a self-paced run that failed in passing again a minute on', async () => {
    const turn = run('failed', 'rate_limit');
    const { handler, loops, loopsOf } = setup(loop(null, null), turn);
    const before = Date.now();
    await handler.execute(finish(turn));
    expect(loopsOf.end).not.toHaveBeenCalled();
    const at = vi.mocked(loops.schedule).mock.calls[0][1];
    expect(at.getTime()).toBeGreaterThanOrEqual(before + 60_000);
  });

  it('does nothing with no loop', async () => {
    const turn = run('cancelled');
    const { handler, loopsOf } = setup(null, turn);
    await handler.execute(finish(turn));
    expect(loopsOf.end).not.toHaveBeenCalled();
  });
});
