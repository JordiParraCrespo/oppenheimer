import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { TELEGRAM_MESSAGES_KEPT_MAX, TELEGRAM_RETENTION_DAYS } from '@oppenheimer/shared';
import type { TelegramAccountRepositoryPort } from '../../database/telegram-account.repository.port';
import type { TelegramMessageRepositoryPort } from '../../database/telegram-message.repository.port';
import { TELEGRAM_ACCOUNT_REPOSITORY, TELEGRAM_MESSAGE_REPOSITORY } from '../../telegram.di-tokens';
import { TelegramMessageMapper } from '../../telegram-message.mapper';
import { ReceiveTelegramMessagesCommand } from './receive-telegram-messages.command';

/** Old messages one intake deletes at most, so a batch never waits on a long purge. */
export const TELEGRAM_PRUNE_BATCH = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps what a host's Telegram bot received, and answers the outbox keys the
 * host may forget: every message stored, or already stored (a resend after a
 * dropped link), and every message for a host with no connected bot, which
 * nobody will read. Intake also deletes a batch of the bot's messages past
 * `TELEGRAM_RETENTION_DAYS`, and of its oldest past `TELEGRAM_MESSAGES_KEPT_MAX`,
 * which is the table's whole retention.
 */
@CommandHandler(ReceiveTelegramMessagesCommand)
export class ReceiveTelegramMessagesCommandHandler
  implements ICommandHandler<ReceiveTelegramMessagesCommand, string[]>
{
  constructor(
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
    @Inject(TELEGRAM_MESSAGE_REPOSITORY)
    private readonly messages: TelegramMessageRepositoryPort,
    private readonly mapper: TelegramMessageMapper,
  ) {}

  async execute({ hostId, messages }: ReceiveTelegramMessagesCommand): Promise<string[]> {
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
      new Date(Date.now() - TELEGRAM_RETENTION_DAYS * DAY_MS),
      TELEGRAM_PRUNE_BATCH,
    );
    await this.messages.pruneBeyond(ref, TELEGRAM_MESSAGES_KEPT_MAX, TELEGRAM_PRUNE_BATCH);
    return keys;
  }
}
