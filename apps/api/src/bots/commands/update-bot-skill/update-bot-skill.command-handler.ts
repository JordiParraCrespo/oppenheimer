import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BOT_SKILL_REPOSITORY } from '../../bots.di-tokens';
import type { BotSkillRepositoryPort } from '../../database/bot-skill.repository.port';
import { type BotActor, userActor } from '../../domain/bot.types';
import { BotErrors } from '../../domain/bots.errors';
import { UpdateBotSkillCommand } from './update-bot-skill.command';

/** Rename, reword, or change who may run a skill; whoever rewords it becomes its source. */
@CommandHandler(UpdateBotSkillCommand)
export class UpdateBotSkillCommandHandler
  implements ICommandHandler<UpdateBotSkillCommand, AggregateID>
{
  constructor(@Inject(BOT_SKILL_REPOSITORY) private readonly skills: BotSkillRepositoryPort) {}

  async execute(command: UpdateBotSkillCommand): Promise<AggregateID> {
    const { scope, botId, skillId } = command;
    const skill = requireFound(
      await this.skills.findOneById(scope, botId, skillId),
      BotErrors.SKILL_NOT_FOUND,
      { detail: `No skill with id ${skillId}` },
    );
    const actor: BotActor = command.author === 'bot' ? { kind: 'bot' } : userActor(scope.userId);
    skill.edit(command.change, actor);
    const outcome = await this.skills.save(skill);
    if (outcome === 'taken') {
      throw new AppError(BotErrors.SKILL_NAME_TAKEN, {
        detail: `The bot already has a skill named "${skill.name}"`,
      });
    }
    if (outcome === 'missing') throw new AppError(BotErrors.SKILL_NOT_FOUND);
    return skill.id;
  }
}
