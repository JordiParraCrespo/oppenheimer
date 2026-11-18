import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { WHATSAPP_TEXT_MAX_CHARS } from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import { SendWhatsappMessageCommand } from '../../whatsapp/commands/send-whatsapp-message/send-whatsapp-message.command';
import type {
  WhatsappChat,
  WhatsappChatTarget,
  WhatsappMessage,
} from '../../whatsapp/domain/whatsapp-message.types';
import {
  FindWhatsappAccountsQuery,
  type WhatsappAccountView,
} from '../../whatsapp/queries/find-whatsapp-accounts/find-whatsapp-accounts.query';
import { FindWhatsappChatsQuery } from '../../whatsapp/queries/find-whatsapp-chats/find-whatsapp-chats.query';
import {
  ReadWhatsappChatQuery,
  type WhatsappChatRead,
} from '../../whatsapp/queries/read-whatsapp-chat/read-whatsapp-chat.query';
import { SearchWhatsappMessagesQuery } from '../../whatsapp/queries/search-whatsapp-messages/search-whatsapp-messages.query';
import {
  describeWhatsappAccount,
  describeWhatsappChat,
  describeWhatsappMessage,
  describeWhatsappTarget,
  fenceWhatsapp,
  NO_WHATSAPP,
  WHATSAPP_UNTRUSTED_NOTE,
} from '../bot-whatsapp-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import { formatToolList } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/** Chats one list shows at most. */
export const WHATSAPP_CHATS_LIMIT_MAX = 50;
/** Messages one read shows at most. */
export const WHATSAPP_READ_LIMIT_MAX = 100;

const account = z.string().trim().min(1).max(100).describe(promptText('tools/whatsapp.account'));

const chat = z.string().trim().min(1).max(200).describe(promptText('tools/whatsapp.chat'));

/** What a send carries once its card is raised: the number and the chat, resolved. */
const plannedSend = z.object({
  accountId: z.string(),
  accountLabel: z.string(),
  chatId: z.string(),
  chatKind: z.enum(['direct', 'group']),
  chatName: z.string().nullable(),
  isNew: z.boolean(),
});
type PlannedSend = z.infer<typeof plannedSend>;

/**
 * WhatsApp: the owner's own linked numbers, their chats as the host saw them
 * since the number was linked, search over what was said, and a message sent as
 * the owner. Reads only see the owner's numbers; what other people wrote comes
 * back inside `<whatsapp>`, marked as data. A send asks by default (Settings →
 * Permissions can allow it per chat), because it speaks for the owner to
 * someone else.
 */
@Injectable()
export class BotWhatsappToolsFactory implements BotToolArea {
  readonly group = 'whatsapp' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.listAccounts(), this.listChats(), this.readChat(), this.search(), this.send()];
  }

  private listAccounts(): BotToolDefinition {
    return defineBotTool({
      name: 'list_whatsapp_accounts',
      readOnly: true,
      scope: 'whatsapp:read',
      description: promptText('tools/whatsapp.list-whatsapp-accounts'),
      input: z.object({}),
      run: async (_input, context) => {
        const views = await this.accounts(context.owner);
        return formatToolList(
          'WhatsApp numbers',
          views.map((view) => describeWhatsappAccount(view.account, view.hostOnline)),
          NO_WHATSAPP,
        );
      },
    });
  }

  private listChats(): BotToolDefinition {
    return defineBotTool({
      name: 'list_whatsapp_chats',
      readOnly: true,
      scope: 'whatsapp:read',
      description: promptText('tools/whatsapp.list-whatsapp-chats', {
        whatsappChatsLimitMax: String(WHATSAPP_CHATS_LIMIT_MAX),
      }),
      input: z.object({
        account: account.optional(),
        limit: z.number().int().min(1).max(WHATSAPP_CHATS_LIMIT_MAX).default(20),
      }),
      run: async (input, context) => {
        const chosen = await this.one(context.owner, input.account);
        const chats = await this.queryBus.execute<FindWhatsappChatsQuery, WhatsappChat[]>(
          new FindWhatsappChatsQuery({
            scope: context.owner,
            accountId: chosen.account.id,
            limit: input.limit,
          }),
        );
        const header = describeWhatsappAccount(chosen.account, chosen.hostOnline);
        if (chats.length === 0) return `${header}: no messages yet.`;
        const lines = chats.map((item) => describeWhatsappChat(item, context.timeZone));
        return [
          `${header}, ${chats.length} chat(s). ${WHATSAPP_UNTRUSTED_NOTE}`,
          fenceWhatsapp(lines.join('\n')),
        ].join('\n');
      },
    });
  }

  private readChat(): BotToolDefinition {
    return defineBotTool({
      name: 'read_whatsapp_chat',
      readOnly: true,
      scope: 'whatsapp:read',
      description: promptText('tools/whatsapp.read-whatsapp-chat', {
        whatsappReadLimitMax: String(WHATSAPP_READ_LIMIT_MAX),
      }),
      input: z.object({
        account: account.optional(),
        chat,
        limit: z.number().int().min(1).max(WHATSAPP_READ_LIMIT_MAX).default(30),
        before: z.iso
          .datetime({ offset: true })
          .optional()
          .describe(promptText('tools/whatsapp.read-whatsapp-chat-before')),
      }),
      run: async (input, context) => {
        const chosen = await this.one(context.owner, input.account);
        const read = await this.queryBus.execute<ReadWhatsappChatQuery, WhatsappChatRead>(
          new ReadWhatsappChatQuery({
            scope: context.owner,
            accountId: chosen.account.id,
            chat: input.chat,
            limit: input.limit,
            before: input.before ? new Date(input.before) : null,
          }),
        );
        const lines = read.messages.map((message) =>
          describeWhatsappMessage(message, context.timeZone),
        );
        return [
          promptText('tools/whatsapp.read-whatsapp-chat-chat-chat-id', {
            describeWhatsappTarget: describeWhatsappTarget(read.chat),
            chatId: read.chat.chatId,
            accountLabel: read.accountLabel,
            messagesCount: String(read.messages.length),
            whatsappUntrustedNote: WHATSAPP_UNTRUSTED_NOTE,
          }),
          lines.length > 0 ? fenceWhatsapp(lines.join('\n')) : 'No messages in that range.',
        ].join('\n');
      },
    });
  }

  private search(): BotToolDefinition {
    return defineBotTool({
      name: 'search_whatsapp',
      readOnly: true,
      scope: 'whatsapp:read',
      description: promptText('tools/whatsapp.search-whatsapp'),
      input: z.object({
        account: account.optional(),
        query: z.string().trim().min(2).max(200),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      run: async (input, context) => {
        const chosen = await this.one(context.owner, input.account);
        const found = await this.queryBus.execute<SearchWhatsappMessagesQuery, WhatsappMessage[]>(
          new SearchWhatsappMessagesQuery({
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
            `chat ${message.chatName ?? message.chatId} (chat id ${message.chatId}) · ${describeWhatsappMessage(message, context.timeZone)}`,
        );
        return [
          `${found.length} match(es). ${WHATSAPP_UNTRUSTED_NOTE}`,
          fenceWhatsapp(lines.join('\n')),
        ].join('\n');
      },
    });
  }

  private send(): BotToolDefinition {
    return defineBotTool({
      name: 'send_whatsapp_message',
      asks: true,
      sharesOutside: true,
      scope: 'whatsapp:write',
      description: promptText('tools/whatsapp.send-whatsapp-message', {
        whatsappTextMaxChars: String(WHATSAPP_TEXT_MAX_CHARS),
      }),
      input: z.object({
        account: account.optional(),
        chat,
        text: z.string().trim().min(1).max(WHATSAPP_TEXT_MAX_CHARS),
        planned: plannedSend
          .optional()
          .describe(promptText('tools/whatsapp.send-whatsapp-message-planned')),
      }),
      normalize: async (input, context) => ({
        ...input,
        planned: await this.plan(input, context.owner),
      }),
      subject: (input) => {
        const planned = plannedOf(input.planned);
        return {
          kind: 'whatsapp_chat',
          key: `${planned.accountId}:${planned.chatId}`,
          label: describeWhatsappTarget(planned),
        };
      },
      summarize: (input) => {
        const planned = plannedOf(input.planned);
        return `Send on WhatsApp from "${planned.accountLabel}" to ${describeWhatsappTarget(planned)}: ${input.text}`;
      },
      run: async (input, context) => {
        // Only a card's stored call carries a plan Oppenheimer made. A call
        // that runs without one (Full access, a grant for the chat) is the
        // model's own input, whose `planned` could name any chat: it is
        // resolved again here, the same way the grant was checked.
        const planned = context.approvalId
          ? plannedOf(input.planned)
          : await this.plan(input, context.owner);
        const id = await this.commandBus.execute<SendWhatsappMessageCommand, string>(
          new SendWhatsappMessageCommand({
            scope: context.owner,
            accountId: planned.accountId,
            chat: {
              chatId: planned.chatId,
              chatKind: planned.chatKind,
              chatName: planned.chatName,
            },
            text: input.text,
            botId: context.botId,
          }),
        );
        return promptText('tools/whatsapp.send-whatsapp-message-sent-whatsapp-from', {
          describeWhatsappTarget: describeWhatsappTarget(planned),
          accountLabel: planned.accountLabel,
          id,
        });
      },
    });
  }

  /** The number and the chat a send means, resolved once so a yes sends where the card said. */
  private async plan(
    input: { account?: string; chat: string },
    owner: AccessScope,
  ): Promise<PlannedSend> {
    const chosen = await this.one(owner, input.account);
    if (!chosen.account.isConnected || !chosen.hostOnline) {
      throw new BotToolRefusal(
        `${describeWhatsappAccount(chosen.account, chosen.hostOnline)}: it cannot send now.`,
      );
    }
    const read = await this.queryBus.execute<ReadWhatsappChatQuery, WhatsappChatRead>(
      new ReadWhatsappChatQuery({
        scope: owner,
        accountId: chosen.account.id,
        chat: input.chat,
        limit: 0,
        targetOnly: true,
      }),
    );
    return {
      accountId: chosen.account.id,
      accountLabel: chosen.account.label,
      ...targetOf(read.chat),
    };
  }

  private accounts(owner: AccessScope): Promise<WhatsappAccountView[]> {
    return this.queryBus.execute<FindWhatsappAccountsQuery, WhatsappAccountView[]>(
      new FindWhatsappAccountsQuery({ scope: owner }),
    );
  }

  /** One number by its id or name, ignoring case; the only one when none is named. */
  private async one(owner: AccessScope, wanted: string | undefined): Promise<WhatsappAccountView> {
    const views = await this.accounts(owner);
    if (views.length === 0) throw new BotToolRefusal(NO_WHATSAPP);
    const listed = () =>
      views.map((view) => describeWhatsappAccount(view.account, view.hostOnline)).join('; ');
    if (!wanted) {
      if (views.length === 1 && views[0]) return views[0];
      throw new BotToolRefusal(
        promptText('tools/whatsapp.one-several-numbers-linked', { listed: listed() }),
      );
    }
    const needle = wanted.trim().toLowerCase();
    const found =
      views.find((view) => view.account.id === wanted.trim()) ??
      views.find((view) => view.account.label.toLowerCase() === needle);
    if (!found)
      throw new BotToolRefusal(
        promptText('tools/whatsapp.one-linked-number-numbers', { wanted, listed: listed() }),
      );
    return found;
  }
}

function targetOf(chat: WhatsappChatTarget): Omit<PlannedSend, 'accountId' | 'accountLabel'> {
  return {
    chatId: chat.chatId,
    chatKind: chat.chatKind,
    chatName: chat.chatName,
    isNew: chat.isNew,
  };
}

/** The send the card stored, which a call carrying out its approval runs. */
function plannedOf(stored: unknown): PlannedSend {
  const parsed = plannedSend.safeParse(stored);
  if (!parsed.success) throw new BotToolRefusal(promptText('tools/whatsapp.planned-of'));
  return parsed.data;
}
