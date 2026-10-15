import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { BOT_TURN_REPOSITORY } from '../../bots.di-tokens';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotTurnEntity } from '../../domain/bot-turn.entity';
import { BotErrors } from '../../domain/bots.errors';
import { FindBotTurnQuery } from './find-bot-turn.query';

/** One turn of a bot in the caller's workspace: what a send or a Stop answers with. */
@QueryHandler(FindBotTurnQuery)
export class FindBotTurnQueryHandler implements IQueryHandler<FindBotTurnQuery, BotTurnEntity> {
  constructor(@Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort) {}

  async execute({ scope, botId, turnId }: FindBotTurnQuery): Promise<BotTurnEntity> {
    return requireFound(await this.turns.findOne(scope, botId, turnId), BotErrors.TURN_NOT_FOUND);
  }
}
