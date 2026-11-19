import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { FindWorkingBotsQuery } from './find-working-bots.query';

/**
 * The bots at work right now: those with a turn queued or running, whatever
 * started it (a message, a routine, another bot, a channel). The sidebar
 * shimmers their names; `botTurn.changed` says when to read it again.
 */
@QueryHandler(FindWorkingBotsQuery)
export class FindWorkingBotsQueryHandler implements IQueryHandler<FindWorkingBotsQuery, string[]> {
  constructor(@Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort) {}

  execute({ scope }: FindWorkingBotsQuery): Promise<string[]> {
    return this.turns.findWorkingBotIds(scope);
  }
}
