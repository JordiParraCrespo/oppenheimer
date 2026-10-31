import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { requireTenant } from '../../../authz/application/tenant-scope.policy';
import { BOT_GROUP_REPOSITORY } from '../../bots.di-tokens';
import type { BotGroupRepositoryPort } from '../../database/bot-group.repository.port';
import { BotGroupEntity } from '../../domain/bot-group.entity';
import { BotErrors } from '../../domain/bots.errors';
import { CreateBotGroupCommand } from './create-bot-group.command';

/** A new sidebar group, last, under a name no other group of the workspace has. */
@CommandHandler(CreateBotGroupCommand)
export class CreateBotGroupCommandHandler
  implements ICommandHandler<CreateBotGroupCommand, AggregateID>
{
  constructor(
    @Inject(BOT_GROUP_REPOSITORY)
    private readonly groups: BotGroupRepositoryPort,
  ) {}

  async execute({ scope, input }: CreateBotGroupCommand): Promise<AggregateID> {
    requireTenant(scope);
    const group = BotGroupEntity.createNew({
      organizationId: scope.organizationId,
      name: input.name,
    });
    if ((await this.groups.insert(group)) === 'name-taken') {
      throw new AppError(BotErrors.GROUP_NAME_TAKEN, { detail: `${group.name} is taken` });
    }
    return group.id;
  }
}
