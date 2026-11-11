import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { WhatsappReplyResolver } from '../../application/whatsapp-reply.resolver';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import { WHATSAPP_ACCOUNT_REPOSITORY, WHATSAPP_MESSAGE_REPOSITORY } from '../../whatsapp.di-tokens';
import { ReplyOnWhatsappCommand } from './reply-on-whatsapp.command';

/**
 * Sends a bot's answer in the owner's chat it was asked in, quoting the
 * owner's message, while the number is connected, the chat is still its
 * confirmed owner's, and the bot is still the chat's bot (its latest switch
 * by name, else the number's default); otherwise nothing goes (the owner
 * switched, changed the default, named another number or unlinked it while
 * the turn ran). Answers how many messages went.
 */
@CommandHandler(ReplyOnWhatsappCommand)
export class ReplyOnWhatsappCommandHandler
  implements ICommandHandler<ReplyOnWhatsappCommand, number>
{
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    private readonly replies: WhatsappReplyResolver,
  ) {}

  async execute(command: ReplyOnWhatsappCommand): Promise<number> {
    const found = await this.accounts.findByIdForSystem(command.organizationId, command.accountId);
    if (found.isNone()) return 0;
    const account = found.unwrap();
    if (!account.isConnected || !account.isOwner(command.chatId)) return 0;
    const ref = { organizationId: account.organizationId, accountId: account.id };
    const chatBotId =
      (await this.messages.findSwitchedBot(ref, command.chatId)) ?? account.answeringBotId;
    if (chatBotId !== command.botId) return 0;
    const quoted = command.replyToRowId
      ? await this.messages.findById(ref, command.replyToRowId)
      : null;
    return this.replies.send(
      account,
      {
        chatId: command.chatId,
        quote: quoted ? { id: quoted.externalId, senderId: quoted.senderId } : null,
      },
      command.text,
      command.botId,
    );
  }
}
