import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_SKILL_REPOSITORY } from '../../bots.di-tokens';
import type { BotSkillRepositoryPort } from '../../database/bot-skill.repository.port';
import type { BotSkillEntity } from '../../domain/bot-skill.entity';
import { FindBotSkillsQuery } from './find-bot-skills.query';

/** Settings → Skills and the composer's slash menu: every skill of the bot, by name. */
@QueryHandler(FindBotSkillsQuery)
export class FindBotSkillsQueryHandler
  implements IQueryHandler<FindBotSkillsQuery, BotSkillEntity[]>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_SKILL_REPOSITORY) private readonly skills: BotSkillRepositoryPort,
  ) {}

  async execute({ scope, botId }: FindBotSkillsQuery): Promise<BotSkillEntity[]> {
    await this.lookup.bot(scope, botId);
    return this.skills.findAll(scope, botId);
  }
}
