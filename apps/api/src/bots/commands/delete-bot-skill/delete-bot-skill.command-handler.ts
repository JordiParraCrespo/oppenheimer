import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BOT_SKILL_REPOSITORY } from '../../bots.di-tokens';
import type { BotSkillRepositoryPort } from '../../database/bot-skill.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import { DeleteBotSkillCommand } from './delete-bot-skill.command';

/** Delete one skill: its slash command goes with it. */
@CommandHandler(DeleteBotSkillCommand)
export class DeleteBotSkillCommandHandler
  implements ICommandHandler<DeleteBotSkillCommand, AggregateID>
{
  constructor(@Inject(BOT_SKILL_REPOSITORY) private readonly skills: BotSkillRepositoryPort) {}

  async execute({ scope, botId, skillId }: DeleteBotSkillCommand): Promise<AggregateID> {
    const skill = requireFound(
      await this.skills.findOneById(scope, botId, skillId),
      BotErrors.SKILL_NOT_FOUND,
      { detail: `No skill with id ${skillId}` },
    );
    await this.skills.delete(skill);
    return skill.id;
  }
}
