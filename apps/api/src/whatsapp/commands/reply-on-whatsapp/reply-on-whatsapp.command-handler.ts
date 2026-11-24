import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { WhatsappAnsweringBotResolver } from '../../application/whatsapp-answering-bot.resolver';
import { WhatsappReplyResolver } from '../../application/whatsapp-reply.resolver';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import { WHATSAPP_MESSAGE_REPOSITORY } from '../../whatsapp.di-tokens';
import { ReplyOnWhatsappCommand } from './reply-on-whatsapp.command';

/**
 * Sends a bot's answer in the chat it was asked in, quoting the message it
 * answers, while the bot still answers that chat on a connected number
 * (`WhatsappAnsweringBotResolver`). Otherwise nothing goes. With `voice` the
 * answer goes as one voice note (`WhatsappReplyResolver.sendVoice`). Answers
 * how many messages went.
 */
@CommandHandler(ReplyOnWhatsappCommand)
export class ReplyOnWhatsappCommandHandler
  implements ICommandHandler<ReplyOnWhatsappCommand, number>
{
  constructor(
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    private readonly answering: WhatsappAnsweringBotResolver,
    private readonly replies: WhatsappReplyResolver,
  ) {}

  async execute(command: ReplyOnWhatsappCommand): Promise<number> {
    const answered = await this.answering.answering(command);
    if (!answered) return 0;
    const { account, chat } = answered;
    const quoted = command.replyToRowId
      ? await this.messages.findById(
          { organizationId: account.organizationId, accountId: account.id },
          command.replyToRowId,
        )
      : null;
    const target = {
      chatId: command.chatId,
      quote: quoted ? { id: quoted.externalId, senderId: quoted.senderId } : null,
      ...(chat && { chat }),
    };
    if (command.voice) {
      return this.replies.sendVoice(account, target, command.text, command.voice, command.botId);
    }
    return this.replies.send(account, target, command.text, command.botId);
  }
}
