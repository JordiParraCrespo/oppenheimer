import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { TelegramAccountRepositoryPort } from '../database/telegram-account.repository.port';
import type { TelegramMessageRepositoryPort } from '../database/telegram-message.repository.port';
import { TelegramErrors } from '../domain/telegram.errors';
import type { TelegramAccountEntity } from '../domain/telegram-account.entity';
import type { TelegramChatTarget } from '../domain/telegram-message.types';
import { pickTelegramChat } from '../domain/telegram-send.policy';
import { TELEGRAM_ACCOUNT_REPOSITORY, TELEGRAM_MESSAGE_REPOSITORY } from '../telegram.di-tokens';
import { TelegramMessageMapper } from '../telegram-message.mapper';

/** Chats a name is looked for among: the Telegram bot's most recently active. */
export const TELEGRAM_CHATS_SCANNED = 500;

/**
 * One of the caller's Telegram bots, and a chat of it from what a bot wrote:
 * a chat's id, a person's `@username`, or a person's or group's name. Only a
 * chat with a kept message is one: Telegram refuses a bot writing first
 * (`telegram.md` §5).
 */
@Injectable()
export class TelegramChatResolver {
  constructor(
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
    @Inject(TELEGRAM_MESSAGE_REPOSITORY)
    private readonly messages: TelegramMessageRepositoryPort,
    private readonly mapper: TelegramMessageMapper,
  ) {}

  async account(scope: AccessScope, accountId: string): Promise<TelegramAccountEntity> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) throw new AppError(TelegramErrors.ACCOUNT_NOT_FOUND);
    return found.unwrap();
  }

  async chat(account: TelegramAccountEntity, wanted: string): Promise<TelegramChatTarget> {
    const ref = { organizationId: account.organizationId, accountId: account.id };
    // An id is looked up whole, so a chat a search found is reachable however
    // long ago it was active; a name is looked for among the recent chats.
    const exact = await this.messages.findChat(ref, wanted.trim());
    if (exact.isSome()) return this.mapper.toChatTarget(exact.unwrap());
    const chats = await this.messages.findChats(ref, TELEGRAM_CHATS_SCANNED);
    const picked = pickTelegramChat(chats, wanted);
    if (picked === 'ambiguous') {
      throw new AppError(TelegramErrors.CHAT_NOT_FOUND, {
        detail: `More than one chat is called "${wanted}": use the chat's id.`,
      });
    }
    if (picked) return this.mapper.toChatTarget(picked);
    throw new AppError(TelegramErrors.CHAT_NOT_FOUND, {
      detail: `No chat of ${account.label} matches "${wanted}". A Telegram bot can only write to someone who wrote to it first.`,
    });
  }
}
