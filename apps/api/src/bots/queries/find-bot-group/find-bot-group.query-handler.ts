import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { BOT_GROUP_REPOSITORY } from '../../bots.di-tokens';
import type { BotGroupRepositoryPort } from '../../database/bot-group.repository.port';
import type { BotGroupEntity } from '../../domain/bot-group.entity';
import { BotErrors } from '../../domain/bots.errors';
import { FindBotGroupQuery } from './find-bot-group.query';

/** No route of its own: the group writes read their answer back through it. */
@QueryHandler(FindBotGroupQuery)
export class FindBotGroupQueryHandler implements IQueryHandler<FindBotGroupQuery, BotGroupEntity> {
  constructor(
    @Inject(BOT_GROUP_REPOSITORY)
    private readonly groups: BotGroupRepositoryPort,
  ) {}

  async execute({ scope, groupId }: FindBotGroupQuery): Promise<BotGroupEntity> {
    return requireFound(await this.groups.findOneById(scope, groupId), BotErrors.GROUP_NOT_FOUND, {
      detail: `No bot group with id ${groupId}`,
    });
  }
}
