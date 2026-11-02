import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { WHATSAPP_MESSAGES_KEPT_MAX, WHATSAPP_RETENTION_DAYS } from '@oppenheimer/shared';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import { WHATSAPP_ACCOUNT_REPOSITORY, WHATSAPP_MESSAGE_REPOSITORY } from '../../whatsapp.di-tokens';
import { WhatsappMessageMapper } from '../../whatsapp-message.mapper';
import { ReceiveWhatsappMessagesCommand } from './receive-whatsapp-messages.command';

/** Old messages one intake deletes at most, so a batch never waits on a long purge. */
export const WHATSAPP_PRUNE_BATCH = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps what a host's number saw, and answers the outbox keys the host may
 * forget: every message stored, or already stored (a resend after a dropped
 * link), and every message for a host with no linked number, which nobody
 * will read. Intake also deletes a batch of the number's messages past
 * `WHATSAPP_RETENTION_DAYS`, and of its oldest past `WHATSAPP_MESSAGES_KEPT_MAX`,
 * which is the table's whole retention.
 */
@CommandHandler(ReceiveWhatsappMessagesCommand)
export class ReceiveWhatsappMessagesCommandHandler
  implements ICommandHandler<ReceiveWhatsappMessagesCommand, string[]>
{
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    private readonly mapper: WhatsappMessageMapper,
  ) {}

  async execute({ hostId, messages }: ReceiveWhatsappMessagesCommand): Promise<string[]> {
    const keys = messages.map((message) => message.key);
    const found = await this.accounts.findByHostForSystem(hostId);
    if (found.isNone()) return keys;
    const account = found.unwrap();
    await this.messages.insertMany(
      messages.map((message) => this.mapper.fromInbound(account, message)),
    );
    const ref = { organizationId: account.organizationId, accountId: account.id };
    await this.messages.pruneBefore(
      ref,
      new Date(Date.now() - WHATSAPP_RETENTION_DAYS * DAY_MS),
      WHATSAPP_PRUNE_BATCH,
    );
    await this.messages.pruneBeyond(ref, WHATSAPP_MESSAGES_KEPT_MAX, WHATSAPP_PRUNE_BATCH);
    return keys;
  }
}
