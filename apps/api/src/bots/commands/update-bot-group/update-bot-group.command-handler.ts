import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BOT_GROUP_REPOSITORY } from '../../bots.di-tokens';
import type { BotGroupRepositoryPort } from '../../database/bot-group.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import { UpdateBotGroupCommand } from './update-bot-group.command';

/** Rename a group, or move it in the sidebar; the other groups close up around it. */
@CommandHandler(UpdateBotGroupCommand)
export class UpdateBotGroupCommandHandler
  implements ICommandHandler<UpdateBotGroupCommand, AggregateID>
{
  constructor(
    @Inject(BOT_GROUP_REPOSITORY)
    private readonly groups: BotGroupRepositoryPort,
  ) {}

  async execute({ scope, groupId, input }: UpdateBotGroupCommand): Promise<AggregateID> {
    const group = requireFound(
      await this.groups.findOneById(scope, groupId),
      BotErrors.GROUP_NOT_FOUND,
      { detail: `No bot group with id ${groupId}` },
    );
    if (input.name !== undefined) group.rename(input.name);
    if (input.position !== undefined) group.moveTo(input.position);
    const outcome = await this.groups.save(group);
    if (outcome === 'name-taken') {
      throw new AppError(BotErrors.GROUP_NAME_TAKEN, { detail: `${group.name} is taken` });
    }
    if (outcome === 'missing') throw new AppError(BotErrors.GROUP_NOT_FOUND);
    return group.id;
  }
}
