import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import { WhatsappChatRoutesResolver } from '../../application/whatsapp-chat-routes.resolver';
import type { WhatsappChatGrantRepositoryPort } from '../../database/whatsapp-chat-grant.repository.port';
import { WhatsappErrors } from '../../domain/whatsapp.errors';
import type { WhatsappChatGrantEntity } from '../../domain/whatsapp-chat-grant.entity';
import {
  type WhatsappRouteRefusal,
  whatsappRouteChanges,
} from '../../domain/whatsapp-chat-route.policy';
import { WHATSAPP_CHAT_GRANT_REPOSITORY } from '../../whatsapp.di-tokens';
import { RouteWhatsappChatsCommand } from './route-whatsapp-chats.command';

/**
 * Who answers a set of a number's chats, from Settings or a bot's page: no
 * one (each chat's grant removed), the number's default, or one of the
 * caller's bots (each chat allowed if it was not, with that bot). Only once
 * the owner's own number is confirmed (`WHATSAPP_015`); only chats Settings
 * lists (`WHATSAPP_010`), never the owner's own nor the number's
 * (`WHATSAPP_017`); never past the number's limit (`WHATSAPP_018`). The bot is
 * read as the caller, so another person's is not found (`BOTS_001`). Each
 * chat is written on its own: a chat allowed meanwhile by a bot keeps that
 * grant, with this route's bot.
 */
@CommandHandler(RouteWhatsappChatsCommand)
export class RouteWhatsappChatsCommandHandler
  implements ICommandHandler<RouteWhatsappChatsCommand, void>
{
  constructor(
    private readonly routes: WhatsappChatRoutesResolver,
    @Inject(WHATSAPP_CHAT_GRANT_REPOSITORY)
    private readonly grants: WhatsappChatGrantRepositoryPort,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(command: RouteWhatsappChatsCommand): Promise<void> {
    const { scope, route, botId } = command;
    const { account, rows } = await this.routes.of(scope, command.accountId);
    if (!account.ownerPhone) throw new AppError(WhatsappErrors.OWNER_NOT_CONFIRMED);
    if (route === 'bot' && botId) await this.queryBus.execute(new FindBotQuery({ scope, botId }));
    const changes = whatsappRouteChanges(account, rows, command.chatIds, route, botId);
    if ('kind' in changes) throw refusalOf(changes);
    for (const grant of changes.delete) await this.grants.delete(grant);
    for (const grant of changes.save) await this.grants.save(grant);
    for (const grant of changes.insert) await this.insert(grant);
  }

  private async insert(grant: WhatsappChatGrantEntity): Promise<void> {
    if ((await this.grants.insert(grant)) === 'inserted') return;
    const of = { organizationId: grant.organizationId, accountId: grant.accountId };
    const raced = await this.grants.findByChat(of, grant.chatId);
    if (raced.isNone()) return;
    const existing = raced.unwrap();
    existing.answerAs(grant.botId);
    await this.grants.save(existing);
  }
}

function refusalOf(refusal: WhatsappRouteRefusal): AppError {
  switch (refusal.kind) {
    case 'unknown':
      return new AppError(WhatsappErrors.CHAT_NOT_FOUND, {
        detail: `The number has not seen the chat ${refusal.chatId}.`,
      });
    case 'not_routable':
      return new AppError(WhatsappErrors.CHAT_NOT_GRANTABLE, {
        detail:
          'Your own chat with the number is always yours, and the number cannot talk to itself.',
      });
    case 'limit':
      return new AppError(WhatsappErrors.GRANT_LIMIT_REACHED);
  }
}
