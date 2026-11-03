import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotLoopResolver } from '../../application/bot-loop.resolver';
import { BOT_LOOP_REPOSITORY, BOT_STREAM, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotLoopRepositoryPort } from '../../database/bot-loop.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import {
  loopRunDecision,
  loopRunTurn,
  nextRunAfter,
  nextRunWhenBusy,
} from '../../domain/bot-loop.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { RunBotLoopCommand } from './run-bot-loop.command';

/**
 * A loop's run came due (`25-bots.md` §4.1, `/loop`): load, decide
 * (`loopRunDecision`), act. A job that is no longer the loop's next run (it
 * was queued, moved, or the loop ended or was replaced) does nothing; an
 * expired loop ends with its line; a loop whose owner can no longer act in
 * the workspace stops. Otherwise the run is queued as the owner, with the
 * loop's count and its next run claimed in the same transaction
 * (`enqueueLoopRun`), so a job delivered twice queues one run and a Stop
 * meanwhile queues none. A run due while the last is still busy is moved,
 * not queued.
 */
@CommandHandler(RunBotLoopCommand)
export class RunBotLoopCommandHandler implements ICommandHandler<RunBotLoopCommand, void> {
  constructor(
    @Inject(BOT_LOOP_REPOSITORY) private readonly loops: BotLoopRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly loopsOf: BotLoopResolver,
  ) {}

  async execute({ loopId, run, at, metadata }: RunBotLoopCommand): Promise<void> {
    const loop = await this.loops.findForRun(loopId);
    if (!loop) return;
    const now = new Date();
    const decision = loopRunDecision(loop, { run, at }, now);
    if (decision === 'stale') return;
    if (decision === 'expire') {
      await this.loopsOf.end(loop, { activity: 'expired', reason: null }, metadata.correlationId);
      return;
    }
    const props = await this.loopsOf.runProps(loop);
    if (!props) {
      await this.loopsOf.end(
        loop,
        { activity: 'stopped', reason: 'access_lost' },
        metadata.correlationId,
      );
      return;
    }

    const { turn, opening } = loopRunTurn(props, loop, run);
    const queued = await this.turns.enqueueLoopRun(turn, opening, metadata.correlationId, loop, {
      next: nextRunAfter(loop, now),
      whenBusy: nextRunWhenBusy(loop, now),
    });
    if (queued === 'staged' || queued === 'waiting') {
      await this.stream.publish(turn.botId, { type: 'turn', turnId: turn.id, status: 'queued' });
    }
  }
}
