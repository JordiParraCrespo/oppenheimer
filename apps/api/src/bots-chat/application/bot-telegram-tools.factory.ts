import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { TELEGRAM_TEXT_MAX_CHARS } from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import { SendTelegramMessageCommand } from '../../telegram/commands/send-telegram-message/send-telegram-message.command';
import type { TelegramChat, TelegramMessage } from '../../telegram/domain/telegram-message.types';
import {
  FindTelegramAccountsQuery,
  type TelegramAccountView,
} from '../../telegram/queries/find-telegram-accounts/find-telegram-accounts.query';
import { FindTelegramChatsQuery } from '../../telegram/queries/find-telegram-chats/find-telegram-chats.query';
import {
  ReadTelegramChatQuery,
  type TelegramChatRead,
} from '../../telegram/queries/read-telegram-chat/read-telegram-chat.query';
import { SearchTelegramMessagesQuery } from '../../telegram/queries/search-telegram-messages/search-telegram-messages.query';
import {
  describeTelegramAccount,
  describeTelegramChat,
  describeTelegramMessage,
  describeTelegramTarget,
  fenceTelegram,
  NO_TELEGRAM,
  plannedTelegramSend,
  TELEGRAM_UNTRUSTED_NOTE,
} from '../bot-telegram-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import { formatToolList } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/** Chats one list shows at most. */
export const TELEGRAM_CHATS_LIMIT_MAX = 50;
/** Messages one read shows at most. */
export const TELEGRAM_READ_LIMIT_MAX = 100;

const account = z.string().trim().min(1).max(100).describe(promptText('tools/telegram.account'));

const chat = z.string().trim().min(1).max(200).describe(promptText('tools/telegram.chat'));

/** What a send carries once its card is raised: the Telegram bot and the chat, resolved. */
const plannedSend = z.object({
  accountId: z.string(),
  accountLabel: z.string(),
  chatId: z.string(),
  chatKind: z.enum(['direct', 'group']),
  chatName: z.string().nullable(),
});
type PlannedSend = z.infer<typeof plannedSend>;

/**
 * Telegram: the owner's own connected Telegram bots, the chats people opened
 * with them since they were connected, search over what was said, and a message
 * sent as the Telegram bot. Reads only see the owner's bots; what other people
 * wrote comes back inside `<telegram>`, marked as data. A send asks by default
 * (Settings → Permissions can allow it per chat), because it speaks to someone
 * else.
 */
@Injectable()
export class BotTelegramToolsFactory implements BotToolArea {
  readonly group = 'telegram' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.listAccounts(), this.listChats(), this.readChat(), this.search(), this.send()];
  }

  private listAccounts(): BotToolDefinition {
    return defineBotTool({
      name: 'list_telegram_accounts',
      readOnly: true,
      scope: 'telegram:read',
      description: promptText('tools/telegram.list-telegram-accounts'),
      input: z.object({}),
      run: async (_input, context) => {
        const views = await this.accounts(context.owner);
        return formatToolList(
          'Telegram bots',
          views.map((view) => describeTelegramAccount(view.account, view.hostOnline)),
          NO_TELEGRAM,
        );
      },
    });
  }

  private listChats(): BotToolDefinition {
    return defineBotTool({
      name: 'list_telegram_chats',
      readOnly: true,
      scope: 'telegram:read',
      description: promptText('tools/telegram.list-telegram-chats', {
        telegramChatsLimitMax: String(TELEGRAM_CHATS_LIMIT_MAX),
      }),
      input: z.object({
        account: account.optional(),
        limit: z.number().int().min(1).max(TELEGRAM_CHATS_LIMIT_MAX).default(20),
      }),
      run: async (input, context) => {
        const chosen = await this.one(context.owner, input.account);
        const chats = await this.queryBus.execute<FindTelegramChatsQuery, TelegramChat[]>(
          new FindTelegramChatsQuery({
            scope: context.owner,
            accountId: chosen.account.id,
            limit: input.limit,
          }),
        );
        const header = describeTelegramAccount(chosen.account, chosen.hostOnline);
        if (chats.length === 0) return `${header}: no messages yet.`;
        const lines = chats.map((item) => describeTelegramChat(item, context.timeZone));
        return [
          `${header}, ${chats.length} chat(s). ${TELEGRAM_UNTRUSTED_NOTE}`,
          fenceTelegram(lines.join('\n')),
        ].join('\n');
      },
    });
  }

  private readChat(): BotToolDefinition {
    return defineBotTool({
      name: 'read_telegram_chat',
      readOnly: true,
      scope: 'telegram:read',
      description: promptText('tools/telegram.read-telegram-chat', {
        telegramReadLimitMax: String(TELEGRAM_READ_LIMIT_MAX),
      }),
      input: z.object({
        account: account.optional(),
        chat,
        limit: z.number().int().min(1).max(TELEGRAM_READ_LIMIT_MAX).default(30),
        before: z.iso
          .datetime({ offset: true })
          .optional()
          .describe(promptText('tools/telegram.read-telegram-chat-before')),
      }),
      run: async (input, context) => {
        const chosen = await this.one(context.owner, input.account);
        const read = await this.queryBus.execute<ReadTelegramChatQuery, TelegramChatRead>(
          new ReadTelegramChatQuery({
            scope: context.owner,
            accountId: chosen.account.id,
            chat: input.chat,
            limit: input.limit,
            before: input.before ? new Date(input.before) : null,
          }),
        );
        const lines = read.messages.map((message) =>
          describeTelegramMessage(message, context.timeZone),
        );
        return [
          promptText('tools/telegram.read-telegram-chat-chat-chat-id', {
            describeTelegramTarget: describeTelegramTarget(read.chat),
            chatId: read.chat.chatId,
            accountLabel: read.accountLabel,
            messagesCount: String(read.messages.length),
            telegramUntrustedNote: TELEGRAM_UNTRUSTED_NOTE,
          }),
          lines.length > 0 ? fenceTelegram(lines.join('\n')) : 'No messages in that range.',
        ].join('\n');
      },
    });
  }

  private search(): BotToolDefinition {
    return defineBotTool({
      name: 'search_telegram',
      readOnly: true,
      scope: 'telegram:read',
      description: promptText('tools/telegram.search-telegram'),
      input: z.object({
        account: account.optional(),
        query: z.string().trim().min(2).max(200),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      run: async (input, context) => {
        const chosen = await this.one(context.owner, input.account);
        const found = await this.queryBus.execute<SearchTelegramMessagesQuery, TelegramMessage[]>(
          new SearchTelegramMessagesQuery({
            scope: context.owner,
            accountId: chosen.account.id,
            query: input.query,
            limit: input.limit,
          }),
        );
        if (found.length === 0)
          return `Nothing on "${chosen.account.label}" says "${input.query}".`;
        const lines = found.map(
          (message) =>
            `chat ${message.chatName ?? message.chatId} (chat id ${message.chatId}) · ${describeTelegramMessage(message, context.timeZone)}`,
        );
        return [
          `${found.length} match(es). ${TELEGRAM_UNTRUSTED_NOTE}`,
          fenceTelegram(lines.join('\n')),
        ].join('\n');
      },
    });
  }

  private send(): BotToolDefinition {
    return defineBotTool({
      name: 'send_telegram_message',
      asks: true,
      sharesOutside: true,
      scope: 'telegram:write',
      description: promptText('tools/telegram.send-telegram-message', {
        telegramTextMaxChars: String(TELEGRAM_TEXT_MAX_CHARS),
      }),
      input: z.object({
        account: account.optional(),
        chat,
        text: z.string().trim().min(1).max(TELEGRAM_TEXT_MAX_CHARS),
        reply_to: z
          .string()
          .regex(/^\d{1,20}$/)
          .optional()
          .describe(promptText('tools/telegram.send-telegram-message-reply-to')),
        planned: plannedSend
          .optional()
          .describe(promptText('tools/telegram.send-telegram-message-planned')),
      }),
      normalize: async (input, context) => ({
        ...input,
        planned: await this.plan(input, context.owner),
      }),
      subject: (input) => {
        const planned = plannedOf(input.planned);
        return {
          kind: 'telegram_chat',
          key: `${planned.accountId}:${planned.chatId}`,
          label: describeTelegramTarget(planned),
        };
      },
      summarize: (input) => {
        const planned = plannedOf(input.planned);
        return `Send on Telegram as "${planned.accountLabel}" to ${describeTelegramTarget(planned)}: ${input.text}`;
      },
      run: async (input, context) => {
        // Only a card's stored call carries a plan Oppenheimer made. A call
        // that runs without one (Full access, a grant for the chat) is the
        // model's own input, whose `planned` could name any chat: it is
        // resolved again here, the same way the grant was checked.
        const planned = context.approvalId
          ? plannedOf(input.planned)
          : await this.plan(input, context.owner);
        const id = await this.commandBus.execute<SendTelegramMessageCommand, string>(
          new SendTelegramMessageCommand({
            scope: context.owner,
            accountId: planned.accountId,
            chat: {
              chatId: planned.chatId,
              chatKind: planned.chatKind,
              chatName: planned.chatName,
            },
            text: input.text,
            replyToId: input.reply_to ?? null,
            botId: context.botId,
          }),
        );
        return promptText('tools/telegram.send-telegram-message-done', {
          describeTelegramTarget: describeTelegramTarget(planned),
          accountLabel: planned.accountLabel,
          id,
        });
      },
    });
  }

  /** The Telegram bot and the chat a send means, resolved once so a yes sends where the card said. */
  private async plan(
    input: { account?: string; chat: string },
    owner: AccessScope,
  ): Promise<PlannedSend> {
    const chosen = await this.one(owner, input.account);
    if (!chosen.account.isConnected || !chosen.hostOnline) {
      throw new BotToolRefusal(
        `${describeTelegramAccount(chosen.account, chosen.hostOnline)}: it cannot send now.`,
      );
    }
    const read = await this.queryBus.execute<ReadTelegramChatQuery, TelegramChatRead>(
      new ReadTelegramChatQuery({
        scope: owner,
        accountId: chosen.account.id,
        chat: input.chat,
        limit: 0,
        targetOnly: true,
      }),
    );
    return plannedTelegramSend(chosen.account, read.chat);
  }

  private accounts(owner: AccessScope): Promise<TelegramAccountView[]> {
    return this.queryBus.execute<FindTelegramAccountsQuery, TelegramAccountView[]>(
      new FindTelegramAccountsQuery({ scope: owner }),
    );
  }

  /** One Telegram bot by its id, name or @username, ignoring case; the only one when none is named. */
  private async one(owner: AccessScope, wanted: string | undefined): Promise<TelegramAccountView> {
    const views = await this.accounts(owner);
    if (views.length === 0) throw new BotToolRefusal(NO_TELEGRAM);
    const listed = () =>
      views.map((view) => describeTelegramAccount(view.account, view.hostOnline)).join('; ');
    if (!wanted) {
      if (views.length === 1 && views[0]) return views[0];
      throw new BotToolRefusal(
        promptText('tools/telegram.one-several-telegram-bots', { listed: listed() }),
      );
    }
    const needle = wanted.trim().toLowerCase();
    const found =
      views.find((view) => view.account.id === wanted.trim()) ??
      views.find((view) => view.account.label.toLowerCase() === needle) ??
      views.find((view) => view.account.username?.toLowerCase() === needle.replace(/^@/, ''));
    if (!found)
      throw new BotToolRefusal(
        promptText('tools/telegram.one-connected-telegram-bot', { wanted, listed: listed() }),
      );
    return found;
  }
}

/** The send the card stored, which a call carrying out its approval runs. */
function plannedOf(stored: unknown): PlannedSend {
  const parsed = plannedSend.safeParse(stored);
  if (!parsed.success) throw new BotToolRefusal(promptText('tools/telegram.planned-of'));
  return parsed.data;
}
