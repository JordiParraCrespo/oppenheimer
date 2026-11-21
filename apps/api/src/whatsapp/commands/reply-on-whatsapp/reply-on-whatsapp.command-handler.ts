import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { WhatsappReplyResolver } from '../../application/whatsapp-reply.resolver';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import type { WhatsappChatGrantRepositoryPort } from '../../database/whatsapp-chat-grant.repository.port';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import type { WhatsappAccountEntity } from '../../domain/whatsapp-account.entity';
import {
  WHATSAPP_ACCOUNT_REPOSITORY,
  WHATSAPP_CHAT_GRANT_REPOSITORY,
  WHATSAPP_MESSAGE_REPOSITORY,
} from '../../whatsapp.di-tokens';
import { ReplyOnWhatsappCommand } from './reply-on-whatsapp.command';

/**
 * Sends a bot's answer in the chat it was asked in, quoting the message it
 * answers, while the number is connected and has a confirmed owner, and the
 * bot is still the chat's bot: in the owner's own chat, its latest switch by
 * name, else the number's default; in a chat the number allows, the bot
 * chosen for it, else the default. Otherwise nothing goes: the owner
 * switched, changed a bot, stopped allowing the chat, named another number or
 * unlinked it while the turn ran. Answers how many messages went.
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
    @Inject(WHATSAPP_CHAT_GRANT_REPOSITORY)
    private readonly grants: WhatsappChatGrantRepositoryPort,
    private readonly replies: WhatsappReplyResolver,
  ) {}

  async execute(command: ReplyOnWhatsappCommand): Promise<number> {
    const found = await this.accounts.findByIdForSystem(command.organizationId, command.accountId);
    if (found.isNone()) return 0;
    const account = found.unwrap();
    if (!account.isConnected || !account.ownerPhone) return 0;
    const ref = { organizationId: account.organizationId, accountId: account.id };
    const chat = account.isOwner(command.chatId)
      ? {
          botId:
            (await this.messages.findSwitchedBot(ref, command.chatId)) ?? account.answeringBotId,
          kind: undefined,
        }
      : await this.allowedChat(ref, account, command.chatId);
    if (!chat || chat.botId !== command.botId) return 0;
    const quoted = command.replyToRowId
      ? await this.messages.findById(ref, command.replyToRowId)
      : null;
    return this.replies.send(
      account,
      {
        chatId: command.chatId,
        quote: quoted ? { id: quoted.externalId, senderId: quoted.senderId } : null,
        ...(chat.kind && { chat: chat.kind }),
      },
      command.text,
      command.botId,
    );
  }

  /**
   * A chat the number allows besides the owner's own: the bot that answers
   * it (the one chosen for it, else the number's default) and what it is;
   * null for a chat it does not allow.
   */
  private async allowedChat(
    ref: { organizationId: string; accountId: string },
    account: WhatsappAccountEntity,
    chatId: string,
  ): Promise<{
    botId: string | null;
    kind: { chatKind: 'direct' | 'group'; chatName: string | null };
  } | null> {
    const found = await this.grants.findByChat(ref, chatId);
    if (found.isNone()) return null;
    const grant = found.unwrap();
    return {
      botId: grant.botId ?? account.answeringBotId,
      kind: { chatKind: grant.chatKind, chatName: grant.chatName },
    };
  }
}
