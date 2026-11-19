import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import { WhatsappChatResolver } from '../../application/whatsapp-chat.resolver';
import type { WhatsappChatGrantRepositoryPort } from '../../database/whatsapp-chat-grant.repository.port';
import { WhatsappErrors } from '../../domain/whatsapp.errors';
import { WHATSAPP_CHAT_GRANT_REPOSITORY } from '../../whatsapp.di-tokens';
import { UpdateWhatsappChatGrantCommand } from './update-whatsapp-chat-grant.command';

/**
 * Chooses which of the caller's bots answers in a chat their number allows, or
 * the number's default. The bot is read as the caller (`BOTS_001`); while it
 * answers there it cannot be deleted (`BOTS_043`).
 */
@CommandHandler(UpdateWhatsappChatGrantCommand)
export class UpdateWhatsappChatGrantCommandHandler
  implements ICommandHandler<UpdateWhatsappChatGrantCommand, AggregateID>
{
  constructor(
    private readonly chats: WhatsappChatResolver,
    @Inject(WHATSAPP_CHAT_GRANT_REPOSITORY)
    private readonly grants: WhatsappChatGrantRepositoryPort,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    scope,
    accountId,
    grantId,
    botId,
  }: UpdateWhatsappChatGrantCommand): Promise<AggregateID> {
    const account = await this.chats.account(scope, accountId);
    const found = await this.grants.findById(
      { organizationId: account.organizationId, accountId: account.id },
      grantId,
    );
    if (found.isNone()) {
      throw new AppError(WhatsappErrors.GRANT_NOT_FOUND, { extensions: { grantId } });
    }
    if (botId) await this.queryBus.execute(new FindBotQuery({ scope, botId }));
    const grant = found.unwrap();
    grant.answerAs(botId);
    await this.grants.save(grant);
    return grant.id;
  }
}
