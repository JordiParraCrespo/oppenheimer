import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { WHATSAPP_KNOWN_CHATS_MAX } from '@oppenheimer/shared';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import type { WhatsappKnownChatRepositoryPort } from '../../database/whatsapp-known-chat.repository.port';
import { whatsappKnownChats } from '../../domain/whatsapp-chat-route.policy';
import {
  WHATSAPP_ACCOUNT_REPOSITORY,
  WHATSAPP_KNOWN_CHAT_REPOSITORY,
} from '../../whatsapp.di-tokens';
import { RecordWhatsappChatsCommand } from './record-whatsapp-chats.command';

/**
 * Keeps the chats a host's device says its number can be reached in, on the
 * number linked there, so Settings lists them before anyone writes. A host
 * with no number linked is ignored: its state report already unlinks it.
 */
@CommandHandler(RecordWhatsappChatsCommand)
export class RecordWhatsappChatsCommandHandler
  implements ICommandHandler<RecordWhatsappChatsCommand, void>
{
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_KNOWN_CHAT_REPOSITORY)
    private readonly known: WhatsappKnownChatRepositoryPort,
  ) {}

  async execute({ hostId, chats }: RecordWhatsappChatsCommand): Promise<void> {
    const found = await this.accounts.findByHostForSystem(hostId);
    if (found.isNone()) return;
    const account = found.unwrap();
    await this.known.record(
      { organizationId: account.organizationId, accountId: account.id },
      whatsappKnownChats(account, chats),
      WHATSAPP_KNOWN_CHATS_MAX,
    );
  }
}
