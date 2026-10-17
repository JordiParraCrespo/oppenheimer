import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BOT_REPOSITORY } from '../../bots.di-tokens';
import type { BotRepositoryPort } from '../../database/bot.repository.port';
import type { BotEntity } from '../../domain/bot.entity';
import { FindBotsQuery } from './find-bots.query';

/** The Employees sidebar: every bot of the workspace, by group and position. */
@QueryHandler(FindBotsQuery)
export class FindBotsQueryHandler implements IQueryHandler<FindBotsQuery, BotEntity[]> {
  constructor(
    @Inject(BOT_REPOSITORY)
    private readonly bots: BotRepositoryPort,
  ) {}

  async execute({ scope }: FindBotsQuery): Promise<BotEntity[]> {
    return this.bots.findAll(scope);
  }
}
