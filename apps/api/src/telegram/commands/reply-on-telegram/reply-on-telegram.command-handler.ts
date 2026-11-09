import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { TelegramReplyResolver } from '../../application/telegram-reply.resolver';
import type { TelegramAccountRepositoryPort } from '../../database/telegram-account.repository.port';
import { TELEGRAM_ACCOUNT_REPOSITORY } from '../../telegram.di-tokens';
import { ReplyOnTelegramCommand } from './reply-on-telegram.command';

/**
 * Sends a bot's answer in the chat it was asked in, while that bot still
 * answers on the Telegram bot and the host polls it; otherwise nothing goes
 * (the person unbound it, or disconnected it, while the turn ran). Answers
 * how many messages went.
 */
@CommandHandler(ReplyOnTelegramCommand)
export class ReplyOnTelegramCommandHandler
  implements ICommandHandler<ReplyOnTelegramCommand, number>
{
  constructor(
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
    private readonly replies: TelegramReplyResolver,
  ) {}

  async execute(command: ReplyOnTelegramCommand): Promise<number> {
    const found = await this.accounts.findByIdForSystem(command.organizationId, command.accountId);
    if (found.isNone()) return 0;
    const account = found.unwrap();
    if (!account.isConnected || account.answeringBotId !== command.botId) return 0;
    return this.replies.send(
      account,
      { chatId: command.chatId, chatName: null, replyToId: command.replyToId },
      command.text,
      command.botId,
    );
  }
}
