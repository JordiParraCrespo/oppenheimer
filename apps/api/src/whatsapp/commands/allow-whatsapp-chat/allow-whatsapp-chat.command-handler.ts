import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { WHATSAPP_CHAT_GRANTS_MAX } from '@oppenheimer/shared';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import { WhatsappChatResolver } from '../../application/whatsapp-chat.resolver';
import type { WhatsappChatGrantRepositoryPort } from '../../database/whatsapp-chat-grant.repository.port';
import { WhatsappErrors } from '../../domain/whatsapp.errors';
import { WhatsappChatGrantEntity } from '../../domain/whatsapp-chat-grant.entity';
import { sameWhatsappNumber } from '../../domain/whatsapp-number.policy';
import { WHATSAPP_CHAT_GRANT_REPOSITORY } from '../../whatsapp.di-tokens';
import { AllowWhatsappChatCommand } from './allow-whatsapp-chat.command';

/**
 * Allows a chat on one of the caller's numbers besides their own: a group, or
 * another person (by name, chat id, or a phone number who has not written
 * yet). Only once the owner's own number is confirmed (`WHATSAPP_015`); never
 * the owner's chat, which is always theirs, nor the number's chat with itself
 * (`WHATSAPP_017`). The bot is read as the caller, so another person's bot is
 * not found (`BOTS_001`). Allowing a chat already allowed changes its bot.
 */
@CommandHandler(AllowWhatsappChatCommand)
export class AllowWhatsappChatCommandHandler
  implements ICommandHandler<AllowWhatsappChatCommand, AggregateID>
{
  constructor(
    private readonly chats: WhatsappChatResolver,
    @Inject(WHATSAPP_CHAT_GRANT_REPOSITORY)
    private readonly grants: WhatsappChatGrantRepositoryPort,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(command: AllowWhatsappChatCommand): Promise<AggregateID> {
    const { scope, botId } = command;
    const account = await this.chats.account(scope, command.accountId);
    if (!account.ownerPhone) throw new AppError(WhatsappErrors.OWNER_NOT_CONFIRMED);
    const target = await this.chats.chat(account, command.chat, { allowNew: true });
    if (
      target.chatKind === 'direct' &&
      (account.isOwner(target.chatId) ||
        (account.phone !== null && sameWhatsappNumber(account.phone, target.chatId)))
    ) {
      throw new AppError(WhatsappErrors.CHAT_NOT_GRANTABLE, {
        detail:
          'Your own chat with the number is always yours, and the number cannot talk to itself.',
      });
    }
    if (botId) await this.queryBus.execute(new FindBotQuery({ scope, botId }));
    const of = { organizationId: account.organizationId, accountId: account.id };

    const existing = await this.grants.findByChat(of, target.chatId);
    if (existing.isSome()) return this.update(existing.unwrap(), target.chatName, botId);
    if ((await this.grants.count(of)) >= WHATSAPP_CHAT_GRANTS_MAX) {
      throw new AppError(WhatsappErrors.GRANT_LIMIT_REACHED);
    }
    const grant = WhatsappChatGrantEntity.allow({
      ...of,
      chatId: target.chatId,
      chatKind: target.chatKind,
      chatName: target.chatName,
      botId: botId ?? null,
      grantedByBotId: command.grantedByBotId,
    });
    if ((await this.grants.insert(grant)) === 'inserted') return grant.id;
    // Allowed at the same moment by another call: that one stands, with this bot.
    const raced = await this.grants.findByChat(of, target.chatId);
    if (raced.isNone()) throw new AppError(WhatsappErrors.GRANT_NOT_FOUND);
    return this.update(raced.unwrap(), target.chatName, botId);
  }

  private async update(
    grant: WhatsappChatGrantEntity,
    chatName: string | null,
    botId: string | null | undefined,
  ): Promise<AggregateID> {
    grant.seenAs(chatName);
    if (botId !== undefined) grant.answerAs(botId);
    await this.grants.save(grant);
    return grant.id;
  }
}
