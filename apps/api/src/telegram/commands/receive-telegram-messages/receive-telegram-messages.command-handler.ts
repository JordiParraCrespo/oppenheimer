import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { TELEGRAM_MESSAGES_KEPT_MAX, TELEGRAM_RETENTION_DAYS } from '@oppenheimer/shared';
import { TelegramAnswerResolver } from '../../application/telegram-answer.resolver';
import type { TelegramAccountRepositoryPort } from '../../database/telegram-account.repository.port';
import type { TelegramMessageRepositoryPort } from '../../database/telegram-message.repository.port';
import { TelegramOwnerWroteDomainEvent } from '../../domain/events/telegram-owner-wrote.domain-event';
import type { TelegramAccountEntity } from '../../domain/telegram-account.entity';
import {
  type TelegramInboundAction,
  telegramInboundAction,
} from '../../domain/telegram-inbound.policy';
import type { TelegramMessageDraft } from '../../domain/telegram-message.types';
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
 *
 * Each new message in a direct chat is also acted on
 * (`telegramInboundAction`): the owner's message wakes the bot that answers
 * here, through `TelegramOwnerWroteDomainEvent` staged with the message; a
 * `start` link's code records the owner; a stranger gets one fixed line a
 * day. The lines go after the messages are stored and are not waited on, so
 * a slow host never holds up intake; a resent message acts on nothing again.
 */
@CommandHandler(ReceiveTelegramMessagesCommand)
export class ReceiveTelegramMessagesCommandHandler
  implements ICommandHandler<ReceiveTelegramMessagesCommand, string[]>
{
  private readonly logger = new Logger(ReceiveTelegramMessagesCommandHandler.name);

  constructor(
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
    @Inject(TELEGRAM_MESSAGE_REPOSITORY)
    private readonly messages: TelegramMessageRepositoryPort,
    private readonly mapper: TelegramMessageMapper,
    private readonly answers: TelegramAnswerResolver,
  ) {}

  async execute({ hostId, messages }: ReceiveTelegramMessagesCommand): Promise<string[]> {
    const keys = messages.map((message) => message.key);
    const found = await this.accounts.findByHostForSystem(hostId);
    if (found.isNone()) return keys;
    const account = found.unwrap();
    const actionOf = (draft: TelegramMessageDraft) => telegramInboundAction(account, draft);
    const inserted = await this.messages.insertMany(
      messages.map((message) => this.mapper.fromInbound(account, message)),
      (draft) => this.owed(account, draft, actionOf(draft)),
    );
    const ref = { organizationId: account.organizationId, accountId: account.id };
    await this.messages.pruneBefore(
      ref,
      new Date(Date.now() - TELEGRAM_RETENTION_DAYS * DAY_MS),
      TELEGRAM_PRUNE_BATCH,
    );
    await this.messages.pruneBeyond(ref, TELEGRAM_MESSAGES_KEPT_MAX, TELEGRAM_PRUNE_BATCH);
    if (inserted.length > 0) {
      void this.answers
        .answer(account, inserted, actionOf)
        .catch((error: unknown) =>
          this.logger.error(
            { message: 'Answering Telegram messages failed', accountId: account.id },
            error instanceof Error ? error.stack : String(error),
          ),
        );
    }
    return keys;
  }

  /** The event a new message owes: the owner wrote to the bot that answers here. */
  private owed(
    account: TelegramAccountEntity,
    draft: TelegramMessageDraft,
    action: TelegramInboundAction,
  ): TelegramOwnerWroteDomainEvent | null {
    if (action.kind !== 'owner' || !account.answeringBotId) return null;
    return new TelegramOwnerWroteDomainEvent({
      aggregateId: account.id,
      reason: `the owner of Telegram bot ${account.id} wrote to it (${action.command}) and bot ${account.answeringBotId} answers there`,
      organizationId: account.organizationId,
      userId: account.userId,
      answeringBotId: account.answeringBotId,
      chatId: draft.chatId,
      messageId: draft.externalId,
      command: action.command,
      text: action.text,
    });
  }
}
