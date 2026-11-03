import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotLoopResolver } from '../../application/bot-loop.resolver';
import { BOT_LOOP_REPOSITORY, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotLoopRepositoryPort } from '../../database/bot-loop.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { loopRunEnd, selfPacedRunAt } from '../../domain/bot-loop.policy';
import { FinishBotLoopRunCommand } from './finish-bot-loop-run.command';

/**
 * A run of a loop ended (`25-bots.md` §4.1, `/loop`): `loopRunEnd` says
 * whether the loop ends, with its line, or a self-paced run that failed in
 * passing is tried again a minute on. A fixed loop's next run was staged
 * when this one was queued, so going on needs nothing here. A loop ended or
 * replaced meanwhile is left as it is.
 */
@CommandHandler(FinishBotLoopRunCommand)
export class FinishBotLoopRunCommandHandler
  implements ICommandHandler<FinishBotLoopRunCommand, void>
{
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_LOOP_REPOSITORY) private readonly loops: BotLoopRepositoryPort,
    private readonly loopsOf: BotLoopResolver,
  ) {}

  async execute({ turnId, metadata }: FinishBotLoopRunCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone() || !found.unwrap().endedAt) return;
    const ended = found.unwrap();
    const loop = await this.loops.findForBot(ended.organizationId, ended.botId);
    if (!loop) return;

    const end = loopRunEnd(loop, ended);
    if (end.kind === 'end') {
      await this.loopsOf.end(
        loop,
        { activity: end.activity, reason: end.reason },
        metadata.correlationId,
      );
      return;
    }
    if (end.kind === 'retry') {
      await this.loops.schedule(loop, selfPacedRunAt(loop, 1, new Date()), metadata.correlationId);
    }
  }
}
