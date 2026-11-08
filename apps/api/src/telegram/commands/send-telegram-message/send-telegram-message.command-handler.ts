import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { TELEGRAM_SENDS_PER_DAY } from '@oppenheimer/shared';
import type {
  TelegramDevicePort,
  TelegramSendOutcome,
} from '../../application/telegram-device.port';
import type { TelegramAccountRepositoryPort } from '../../database/telegram-account.repository.port';
import type { TelegramMessageRepositoryPort } from '../../database/telegram-message.repository.port';
import { TelegramErrors } from '../../domain/telegram.errors';
import { telegramSendRefusal } from '../../domain/telegram-send.policy';
import {
  TELEGRAM_ACCOUNT_REPOSITORY,
  TELEGRAM_DEVICE,
  TELEGRAM_MESSAGE_REPOSITORY,
} from '../../telegram.di-tokens';
import { TelegramMessageMapper } from '../../telegram-message.mapper';
import { SendTelegramMessageCommand } from './send-telegram-message.command';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sends a bot's message through one of its owner's Telegram bots
 * (`telegram.md` §5): only while the host polls it and under the day's share,
 * through the host's runner, which paces sends to Telegram's own limits.
 * What went is kept beside what the Telegram bot received, marked as the
 * bot's, so the chat reads whole and the day's sends can be counted. Answers
 * Telegram's id for the message.
 */
@CommandHandler(SendTelegramMessageCommand)
export class SendTelegramMessageCommandHandler
  implements ICommandHandler<SendTelegramMessageCommand, string>
{
  constructor(
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
    @Inject(TELEGRAM_MESSAGE_REPOSITORY)
    private readonly messages: TelegramMessageRepositoryPort,
    @Inject(TELEGRAM_DEVICE)
    private readonly device: TelegramDevicePort,
    private readonly mapper: TelegramMessageMapper,
  ) {}

  async execute(command: SendTelegramMessageCommand): Promise<string> {
    const found = await this.accounts.findOwnById(command.scope, command.accountId);
    if (found.isNone()) throw new AppError(TelegramErrors.ACCOUNT_NOT_FOUND);
    const account = found.unwrap();
    const ref = { organizationId: account.organizationId, accountId: account.id };
    const sentToday = await this.messages.countBotSendsSince(ref, new Date(Date.now() - DAY_MS));
    const refusal = telegramSendRefusal(account.status, sentToday, TELEGRAM_SENDS_PER_DAY);
    if (refusal === 'not_connected') {
      throw new AppError(TelegramErrors.NOT_CONNECTED, {
        detail: `The Telegram bot is ${account.status}.`,
      });
    }
    if (refusal === 'limit_reached') {
      throw new AppError(TelegramErrors.SEND_LIMIT_REACHED, {
        detail: `Bots sent ${sentToday} messages through it in the last day; ${TELEGRAM_SENDS_PER_DAY} is the most.`,
      });
    }

    const sent = sentOrThrow(
      await this.device.send(
        account.hostId,
        command.chat.chatId,
        command.text,
        command.replyToId ?? undefined,
      ),
    );
    await this.messages.recordBotSend(
      this.mapper.fromBotSend({
        account,
        chat: command.chat,
        text: command.text,
        replyToId: command.replyToId,
        sent,
        botId: command.botId,
      }),
    );
    return sent.id;
  }
}

/** The host's answer, or the problem a bot is told. */
function sentOrThrow(outcome: TelegramSendOutcome): { id: string; sentAt: Date } {
  switch (outcome.kind) {
    case 'sent':
      return outcome;
    case 'host_offline':
      throw new AppError(TelegramErrors.HOST_OFFLINE);
    case 'not_supported':
      throw new AppError(TelegramErrors.HOST_UNSUPPORTED);
    case 'timed_out':
      throw new AppError(TelegramErrors.SEND_FAILED, {
        detail: 'The host did not answer in time; the message may still have gone.',
      });
    case 'failed':
      if (outcome.code === 'TG_003') throw new AppError(TelegramErrors.NOT_CONNECTED);
      throw new AppError(TelegramErrors.SEND_FAILED, {
        detail: outcome.detail ?? outcome.code,
        extensions: { upstreamCode: outcome.code },
      });
  }
}
