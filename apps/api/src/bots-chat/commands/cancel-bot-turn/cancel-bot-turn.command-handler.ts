import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_STREAM, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { CancelBotTurnCommand } from './cancel-bot-turn.command';

/**
 * Stop (`25-bots.md` §2). A queued turn is cancelled here and the bot's next
 * one becomes due; a running one is asked to stop, and its worker ends it
 * within a second. A turn that already ended is left as it is.
 */
@CommandHandler(CancelBotTurnCommand)
export class CancelBotTurnCommandHandler implements ICommandHandler<CancelBotTurnCommand, string> {
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async execute({ scope, botId, turnId, metadata }: CancelBotTurnCommand): Promise<string> {
    const turn = requireFound(
      await this.turns.findOne(scope, botId, turnId),
      BotErrors.TURN_NOT_FOUND,
    );
    if (turn.status === 'running') {
      await this.turns.requestCancel(turn, new Date());
      return turn.id;
    }
    if (turn.status !== 'queued') return turn.id;
    turn.end('cancelled', new Date());
    if (await this.turns.finish(turn, metadata.correlationId)) {
      await this.stream.publish(botId, { type: 'turn', turnId, status: 'cancelled' });
    }
    return turn.id;
  }
}
