import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BOT_SKILLS_MAX } from '@oppenheimer/shared';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_SKILL_REPOSITORY } from '../../bots.di-tokens';
import type { BotSkillRepositoryPort } from '../../database/bot-skill.repository.port';
import { type BotActor, userActor } from '../../domain/bot.types';
import { BotSkillEntity } from '../../domain/bot-skill.entity';
import { BotErrors } from '../../domain/bots.errors';
import { CreateBotSkillCommand } from './create-bot-skill.command';

/** A new skill, while the bot has room for one and no other skill has its name. */
@CommandHandler(CreateBotSkillCommand)
export class CreateBotSkillCommandHandler
  implements ICommandHandler<CreateBotSkillCommand, AggregateID>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_SKILL_REPOSITORY) private readonly skills: BotSkillRepositoryPort,
  ) {}

  async execute(command: CreateBotSkillCommand): Promise<AggregateID> {
    const bot = await this.lookup.bot(command.scope, command.botId);
    const actor: BotActor =
      command.author === 'bot' ? { kind: 'bot' } : userActor(command.scope.userId);
    const skill = BotSkillEntity.createNew({
      organizationId: bot.organizationId,
      botId: bot.id,
      name: command.name,
      description: command.description,
      body: command.body,
      userInvocable: command.userInvocable,
      modelInvocable: command.modelInvocable,
      actor,
    });
    const outcome = await this.skills.insert(skill, BOT_SKILLS_MAX);
    if (outcome === 'full') {
      throw new AppError(BotErrors.SKILLS_FULL, {
        detail: `A bot keeps at most ${BOT_SKILLS_MAX} skills; delete one first`,
      });
    }
    if (outcome === 'taken') {
      throw new AppError(BotErrors.SKILL_NAME_TAKEN, {
        detail: `The bot already has a skill named "${skill.name}"`,
      });
    }
    if (outcome === 'missing') throw new AppError(BotErrors.NOT_FOUND);
    return skill.id;
  }
}
