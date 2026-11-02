import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_TOOL_PERMISSION_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotToolPermissionRepositoryPort } from '../../database/bot-tool-permission.repository.port';
import { DeleteBotToolGrantCommand } from './delete-bot-tool-grant.command';

/** Removes one of a bot's standing grants (`25-bots.md` §5): the next call on that thing asks again. One that is not this bot's, or is gone, is `BOTS_033`. */
@CommandHandler(DeleteBotToolGrantCommand)
export class DeleteBotToolGrantCommandHandler
  implements ICommandHandler<DeleteBotToolGrantCommand, string>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_TOOL_PERMISSION_REPOSITORY) private readonly store: BotToolPermissionRepositoryPort,
  ) {}

  async execute({ scope, botId, grantId }: DeleteBotToolGrantCommand): Promise<string> {
    const bot = await this.lookup.bot(scope, botId);
    if (!(await this.store.deleteGrant(scope, bot.id, grantId))) {
      throw new AppError(BotErrors.TOOL_GRANT_NOT_FOUND);
    }
    return grantId;
  }
}
