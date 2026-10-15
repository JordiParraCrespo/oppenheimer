import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BOT_GROUP_REPOSITORY } from '../../bots.di-tokens';
import type { BotGroupRepositoryPort } from '../../database/bot-group.repository.port';
import type { BotGroupEntity } from '../../domain/bot-group.entity';
import { FindBotGroupsQuery } from './find-bot-groups.query';

@QueryHandler(FindBotGroupsQuery)
export class FindBotGroupsQueryHandler
  implements IQueryHandler<FindBotGroupsQuery, BotGroupEntity[]>
{
  constructor(
    @Inject(BOT_GROUP_REPOSITORY)
    private readonly groups: BotGroupRepositoryPort,
  ) {}

  async execute({ scope }: FindBotGroupsQuery): Promise<BotGroupEntity[]> {
    return this.groups.findAll(scope);
  }
}
