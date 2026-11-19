import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { WhatsappChatResolver } from '../../application/whatsapp-chat.resolver';
import type { WhatsappChatGrantRepositoryPort } from '../../database/whatsapp-chat-grant.repository.port';
import { WhatsappErrors } from '../../domain/whatsapp.errors';
import { WHATSAPP_CHAT_GRANT_REPOSITORY } from '../../whatsapp.di-tokens';
import { RevokeWhatsappChatCommand } from './revoke-whatsapp-chat.command';

/** A chat the caller's number allowed is no longer allowed; what was said in it stays kept. */
@CommandHandler(RevokeWhatsappChatCommand)
export class RevokeWhatsappChatCommandHandler
  implements ICommandHandler<RevokeWhatsappChatCommand, void>
{
  constructor(
    private readonly chats: WhatsappChatResolver,
    @Inject(WHATSAPP_CHAT_GRANT_REPOSITORY)
    private readonly grants: WhatsappChatGrantRepositoryPort,
  ) {}

  async execute({ scope, accountId, grantId }: RevokeWhatsappChatCommand): Promise<void> {
    const account = await this.chats.account(scope, accountId);
    const found = await this.grants.findById(
      { organizationId: account.organizationId, accountId: account.id },
      grantId,
    );
    if (found.isNone()) {
      throw new AppError(WhatsappErrors.GRANT_NOT_FOUND, { extensions: { grantId } });
    }
    await this.grants.delete(found.unwrap());
  }
}
