import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { BOT_SKILL_REPOSITORY } from '../../bots.di-tokens';
import type { BotSkillRepositoryPort } from '../../database/bot-skill.repository.port';
import type { BotSkillEntity } from '../../domain/bot-skill.entity';
import { BotErrors } from '../../domain/bots.errors';
import { FindBotSkillQuery } from './find-bot-skill.query';

/** No route of its own: writing a skill reads its answer back through it, and so do the bot's tools. */
@QueryHandler(FindBotSkillQuery)
export class FindBotSkillQueryHandler implements IQueryHandler<FindBotSkillQuery, BotSkillEntity> {
  constructor(@Inject(BOT_SKILL_REPOSITORY) private readonly skills: BotSkillRepositoryPort) {}

  async execute({ scope, botId, skill }: FindBotSkillQuery): Promise<BotSkillEntity> {
    const found =
      'id' in skill
        ? await this.skills.findOneById(scope, botId, skill.id)
        : await this.skills.findOneByName(scope, botId, skill.name);
    return requireFound(found, BotErrors.SKILL_NOT_FOUND, {
      detail: 'id' in skill ? `No skill with id ${skill.id}` : `No skill named "${skill.name}"`,
    });
  }
}
