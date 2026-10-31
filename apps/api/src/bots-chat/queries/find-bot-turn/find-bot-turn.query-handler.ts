import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotTurnEntity } from '../../domain/bot-turn.entity';
import { FindBotTurnQuery } from './find-bot-turn.query';

/**
 * One turn of a bot in the caller's workspace: what a send or a Stop answers
 * with. A send's steer may be taken by the running turn before this reads it
 * (`takeSteers` deletes its queued turn): it answers the turn that holds the
 * message then, so a delivered message never reads as not found.
 */
@QueryHandler(FindBotTurnQuery)
export class FindBotTurnQueryHandler implements IQueryHandler<FindBotTurnQuery, BotTurnEntity> {
  constructor(@Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort) {}

  async execute({
    scope,
    botId,
    turnId,
    openingMessageId,
  }: FindBotTurnQuery): Promise<BotTurnEntity> {
    const found = await this.turns.findOne(scope, botId, turnId);
    if (found.isSome() || !openingMessageId) return requireFound(found, BotErrors.TURN_NOT_FOUND);
    return requireFound(
      await this.turns.findHolding(scope, botId, openingMessageId),
      BotErrors.TURN_NOT_FOUND,
    );
  }
}
