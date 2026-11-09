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
  telegramInboundAction,
} from '../domain/telegram-inbound.policy';
import type { TelegramMessageDraft } from '../domain/telegram-message.types';
import { TELEGRAM_ACCOUNT_REPOSITORY, TELEGRAM_MESSAGE_REPOSITORY } from '../telegram.di-tokens';
import { TelegramReplyResolver } from './telegram-reply.resolver';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What new messages to a Telegram bot come to, and are answered with besides
 * a bot's turn (`product/next-steps/answering-on-telegram-and-whatsapp.md`
 * §2): a `start` link's code records its sender as the owner and says so; a
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

  /**
   * What each message of a batch comes to, in the order they came
   * (`telegramInboundAction`), keyed `chat/id`. A `start` link's code is
   * claimed here, before the messages after it are read, so the owner's
   * first message in the same batch is already theirs; a code that records
   * nobody is a stranger's message. A batch sent again claims nothing more.
   */
  async decide(
    account: TelegramAccountEntity,
    drafts: readonly TelegramMessageDraft[],
  ): Promise<Map<string, TelegramInboundAction>> {
    const now = new Date();
    const actions = new Map<string, TelegramInboundAction>();
    for (const draft of drafts) {
      const action = telegramInboundAction(account, draft);
      const decided: TelegramInboundAction =
        action.kind !== 'link'
          ? action
          : (await this.claim(account, action.code, draft, now))
            ? { kind: 'reply', text: TELEGRAM_LINKED_LINE }
            : { kind: 'stranger' };
      actions.set(`${draft.chatId}/${draft.externalId}`, decided);
    }
    return actions;
  }

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
      if (action.kind === 'stranger') {
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
