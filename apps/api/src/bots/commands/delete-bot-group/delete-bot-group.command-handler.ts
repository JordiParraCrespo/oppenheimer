import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BOT_GROUP_REPOSITORY } from '../../bots.di-tokens';
import type { BotGroupRepositoryPort } from '../../database/bot-group.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import { DeleteBotGroupCommand } from './delete-bot-group.command';

/** The group goes; its bots stay, ungrouped, after the bots already there. */
@CommandHandler(DeleteBotGroupCommand)
export class DeleteBotGroupCommandHandler
  implements ICommandHandler<DeleteBotGroupCommand, AggregateID>
{
  constructor(
    @Inject(BOT_GROUP_REPOSITORY)
    private readonly groups: BotGroupRepositoryPort,
  ) {}

  async execute({ scope, groupId }: DeleteBotGroupCommand): Promise<AggregateID> {
    const group = requireFound(
      await this.groups.findOneById(scope, groupId),
      BotErrors.GROUP_NOT_FOUND,
      { detail: `No bot group with id ${groupId}` },
    );
    await this.groups.delete(group);
    return group.id;
  }
}
