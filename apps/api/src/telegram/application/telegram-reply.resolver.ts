import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TelegramMessageRepositoryPort } from '../database/telegram-message.repository.port';
import type { TelegramAccountEntity } from '../domain/telegram-account.entity';
import { splitTelegramText } from '../domain/telegram-text.policy';
import { TELEGRAM_DEVICE, TELEGRAM_MESSAGE_REPOSITORY } from '../telegram.di-tokens';
import { TelegramMessageMapper } from '../telegram-message.mapper';
import type { TelegramDevicePort } from './telegram-device.port';

/** Where a reply goes: a direct chat of the account's Telegram bot. */
export interface TelegramReplyTarget {
  chatId: string;
  chatName: string | null;
  /** The message it answers; Telegram shows the reply under it. */
  replyToId: string | null;
}

/**
 * Sends a reply in a chat the Telegram bot is answering in, not as a tool's
 * send: the answer to the owner's own message, or a fixed line. It is cut to
 * Telegram's length, paced by the host, and kept beside what the bot
 * received, marked with the Oppenheimer bot that wrote it (null for a fixed
 * line). It answers how many parts went; a part the host did not send ends it
 * there, logged, since the person is not waiting on a request to be told.
 */
@Injectable()
export class TelegramReplyResolver {
  private readonly logger = new Logger(TelegramReplyResolver.name);

  constructor(
    @Inject(TELEGRAM_DEVICE)
    private readonly device: TelegramDevicePort,
    @Inject(TELEGRAM_MESSAGE_REPOSITORY)
    private readonly messages: TelegramMessageRepositoryPort,
    private readonly mapper: TelegramMessageMapper,
  ) {}

  async send(
    account: TelegramAccountEntity,
    target: TelegramReplyTarget,
    text: string,
    botId: string | null,
  ): Promise<number> {
    let sentParts = 0;
    for (const [index, part] of splitTelegramText(text).entries()) {
      const replyToId = index === 0 ? (target.replyToId ?? undefined) : undefined;
      const outcome = await this.device.send(account.hostId, target.chatId, part, replyToId);
      if (outcome.kind !== 'sent') {
        this.logger.warn({
          message: 'A Telegram reply was not sent',
          accountId: account.id,
          outcome: outcome.kind,
          ...(outcome.kind === 'failed' ? { code: outcome.code } : {}),
        });
        return sentParts;
      }
      await this.messages.recordBotSend(
        this.mapper.fromBotSend({
          account,
          chat: { chatId: target.chatId, chatKind: 'direct', chatName: target.chatName },
          text: part,
          replyToId: replyToId ?? null,
          sent: outcome,
          botId,
        }),
      );
      sentParts += 1;
    }
    return sentParts;
  }
}
