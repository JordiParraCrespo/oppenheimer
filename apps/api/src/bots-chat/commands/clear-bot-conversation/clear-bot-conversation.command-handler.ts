import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { ClearBotConversationCommand } from './clear-bot-conversation.command';

/**
 * Clear history (Settings → Profile): the bot's conversation is erased, its
 * turns, messages, summary and approvals, while its soul, instructions and
 * memory stay. Refused while a turn is queued or running, which would go on
 * writing into a conversation that is gone: Stop it first.
 */
@CommandHandler(ClearBotConversationCommand)
export class ClearBotConversationCommandHandler
  implements ICommandHandler<ClearBotConversationCommand, string>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
  ) {}

  async execute({ scope, botId }: ClearBotConversationCommand): Promise<string> {
    const bot = await this.lookup.bot(scope, botId);
    const outcome = await this.turns.clearConversation(bot.organizationId, bot.id);
    if (outcome === 'missing') throw new AppError(BotErrors.NOT_FOUND);
    if (outcome === 'busy') {
      throw new AppError(BotErrors.CONVERSATION_BUSY, {
        detail: 'Stop the running turn, then clear the history',
      });
    }
    return bot.id;
  }
}
