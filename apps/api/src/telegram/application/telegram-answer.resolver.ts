import { Inject, Injectable } from '@nestjs/common';
import type { TelegramAccountRepositoryPort } from '../database/telegram-account.repository.port';
import type { TelegramMessageRepositoryPort } from '../database/telegram-message.repository.port';
import type { TelegramAccountEntity } from '../domain/telegram-account.entity';
import {
  TELEGRAM_LINKED_LINE,
  TELEGRAM_NEW_LINE,
  TELEGRAM_STOP_LINE,
  TELEGRAM_STRANGER_LINE,
  type TelegramInboundAction,
} from '../domain/telegram-inbound.policy';
import type { TelegramMessageDraft } from '../domain/telegram-message.types';
import { TELEGRAM_ACCOUNT_REPOSITORY, TELEGRAM_MESSAGE_REPOSITORY } from '../telegram.di-tokens';
import { TelegramReplyResolver } from './telegram-reply.resolver';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What new messages to a Telegram bot are answered with, besides a bot's
 * turn (`product/next-steps/answering-on-telegram-and-whatsapp.md` §2): a
 * `start` link's code records its sender as the owner and says so; a
 * stranger, or a code that records nobody, gets one fixed line a day and
 * nothing else; the owner's `/help`, `/new` and `/stop` get theirs.
 */
@Injectable()
export class TelegramAnswerResolver {
  constructor(
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
    @Inject(TELEGRAM_MESSAGE_REPOSITORY)
    private readonly messages: TelegramMessageRepositoryPort,
    private readonly replies: TelegramReplyResolver,
  ) {}

  /** The fixed lines the new messages are owed, in the order they came. */
  async answer(
    account: TelegramAccountEntity,
    inserted: readonly TelegramMessageDraft[],
    actionOf: (draft: TelegramMessageDraft) => TelegramInboundAction,
  ): Promise<void> {
    const now = new Date();
    for (const draft of inserted) {
      const target = {
        chatId: draft.chatId,
        chatName: draft.chatName,
        replyToId: draft.externalId,
      };
      const action = actionOf(draft);
      if (action.kind === 'link' && (await this.claim(account, action.code, draft, now))) {
        await this.replies.send(account, target, TELEGRAM_LINKED_LINE, null);
      } else if (action.kind === 'link' || action.kind === 'stranger') {
        const ref = { organizationId: account.organizationId, accountId: account.id };
        if (
          await this.messages.wroteInChatSince(ref, draft.chatId, new Date(now.getTime() - DAY_MS))
        ) {
          continue;
        }
        await this.replies.send(
          account,
          { ...target, replyToId: null },
          TELEGRAM_STRANGER_LINE,
          null,
        );
      } else if (action.kind === 'reply') {
        await this.replies.send(account, target, action.text, null);
      } else if (action.kind === 'owner' && action.command !== 'message') {
        const line = action.command === 'new' ? TELEGRAM_NEW_LINE : TELEGRAM_STOP_LINE;
        await this.replies.send(account, target, line, null);
      }
    }
  }

  /** Whether `/start <code>` recorded its sender as the owner. */
  private async claim(
    account: TelegramAccountEntity,
    code: string,
    draft: TelegramMessageDraft,
    now: Date,
  ): Promise<boolean> {
    const usedCodeHash = account.ownerLinkCodeHash;
    if (!usedCodeHash || !account.claimOwner(code, draft.senderId, now)) return false;
    return this.accounts.saveOwner(account, usedCodeHash);
  }
}
