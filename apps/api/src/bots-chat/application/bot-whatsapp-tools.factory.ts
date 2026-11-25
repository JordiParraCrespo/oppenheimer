import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { WHATSAPP_TEXT_MAX_CHARS } from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import {
  type SpokenAudio,
  SynthesizeSpeechCommand,
} from '../../voice/commands/synthesize-speech/synthesize-speech.command';
import { SPEECH_TEXT_MAX_CHARS } from '../../voice/domain/voice-synthesis.policy';
import { FindSpeechSynthesisQuery } from '../../voice/queries/find-speech-synthesis/find-speech-synthesis.query';
import { SendWhatsappMessageCommand } from '../../whatsapp/commands/send-whatsapp-message/send-whatsapp-message.command';
import type {
  WhatsappChat,
  WhatsappChatTarget,
  WhatsappMessage,
} from '../../whatsapp/domain/whatsapp-message.types';
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
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';
import {
  whatsappAccountInput as account,
  BotWhatsappAccountsResolver,
  whatsappChatInput as chat,
} from './bot-whatsapp-accounts.resolver';

/** Chats one list shows at most. */
export const WHATSAPP_CHATS_LIMIT_MAX = 50;
/** Messages one read shows at most. */
export const WHATSAPP_READ_LIMIT_MAX = 100;

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

/** What one send tool says and does beyond the plan every send shares (`askingSend`). */
interface AskingSendSpec {
  name: string;
  description: string;
  /** The text the tool takes, with its own bound. */
  text: z.ZodString;
  /** Refuses the call when it cannot go at all: before any card, and again before it runs. */
  ready?: (organizationId: string) => Promise<void>;
  /** The card's line: every word that goes, and where. */
  summarize(planned: PlannedSend, text: string): string;
  /** Sends the text to the planned chat, and answers what the model is told. */
  deliver(planned: PlannedSend, text: string, context: BotToolCallContext): Promise<string>;
}

/**
 * WhatsApp: the owner's own linked numbers, their chats as the host saw them
 * since the number was linked, search over what was said, and a message sent as
 * the owner, as text or as a voice note spoken from a short text. Reads only
 * see the owner's numbers; what other people wrote comes back inside
 * `<whatsapp>`, marked as data. A send asks by default (Settings →
 * Permissions can allow it per chat), because it speaks for the owner to
 * someone else; a voice note is a tool of its own, so a chat allowed for text
 * is not thereby allowed for the owner's voice.
 */
@Injectable()
export class BotWhatsappToolsFactory implements BotToolArea {
  readonly group = 'whatsapp' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly accounts: BotWhatsappAccountsResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.listAccounts(),
      this.listChats(),
      this.readChat(),
      this.search(),
      this.send(),
      this.sendVoice(),
    ];
  }

  private listAccounts(): BotToolDefinition {
    return defineBotTool({
      name: 'list_whatsapp_accounts',
      readOnly: true,
      scope: 'whatsapp:read',
      description: promptText('whatsapp/tools.list-whatsapp-accounts'),
      input: z.object({}),
      run: async (_input, context) => {
        const views = await this.accounts.all(context.owner);
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
      description: promptText('whatsapp/tools.list-whatsapp-chats', {
        whatsappChatsLimitMax: String(WHATSAPP_CHATS_LIMIT_MAX),
      }),
      input: z.object({
        account: account.optional(),
        limit: z.number().int().min(1).max(WHATSAPP_CHATS_LIMIT_MAX).default(20),
      }),
      run: async (input, context) => {
        const chosen = await this.accounts.one(context.owner, input.account);
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
      description: promptText('whatsapp/tools.read-whatsapp-chat', {
        whatsappReadLimitMax: String(WHATSAPP_READ_LIMIT_MAX),
      }),
      input: z.object({
        account: account.optional(),
        chat,
        limit: z.number().int().min(1).max(WHATSAPP_READ_LIMIT_MAX).default(30),
        before: z.iso
          .datetime({ offset: true })
          .optional()
          .describe(promptText('whatsapp/tools.read-whatsapp-chat-before')),
      }),
      run: async (input, context) => {
        const chosen = await this.accounts.one(context.owner, input.account);
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
          promptText('whatsapp/tools.read-whatsapp-chat-chat-chat-id', {
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
      description: promptText('whatsapp/tools.search-whatsapp'),
      input: z.object({
        account: account.optional(),
        query: z.string().trim().min(2).max(200),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      run: async (input, context) => {
        const chosen = await this.accounts.one(context.owner, input.account);
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
    return this.askingSend({
      name: 'send_whatsapp_message',
      description: promptText('whatsapp/tools.send-whatsapp-message', {
        whatsappTextMaxChars: String(WHATSAPP_TEXT_MAX_CHARS),
      }),
      text: z.string().trim().min(1).max(WHATSAPP_TEXT_MAX_CHARS),
      summarize: (planned, text) =>
        `Send on WhatsApp from "${planned.accountLabel}" to ${describeWhatsappTarget(planned)}: ${text}`,
      deliver: async (planned, text, context) => {
        const id = await this.sendAs(planned, text, context);
        return promptText('whatsapp/tools.send-whatsapp-message-done', {
          describeWhatsappTarget: describeWhatsappTarget(planned),
          accountLabel: planned.accountLabel,
          id,
        });
      },
    });
  }

  private sendVoice(): BotToolDefinition {
    return this.askingSend({
      name: 'send_whatsapp_voice_note',
      description: promptText('whatsapp/tools.send-whatsapp-voice-note', {
        speechTextMaxChars: String(SPEECH_TEXT_MAX_CHARS),
      }),
      text: z
        .string()
        .trim()
        .min(1)
        .max(SPEECH_TEXT_MAX_CHARS)
        .describe(promptText('whatsapp/tools.send-whatsapp-voice-note-text')),
      // A yes the workspace cannot speak would be a wait for nothing.
      ready: (organizationId) => this.requireSpeech(organizationId),
      // The card quotes every word the note will say, and where it goes.
      summarize: (planned, text) =>
        `Send a voice note on WhatsApp from "${planned.accountLabel}" to ${describeWhatsappTarget(planned)}, saying: ${text}`,
      deliver: async (planned, text, context) => {
        // Spoken from the text the card showed, held in memory for this call
        // only, and dropped once the host has it.
        const spoken = await this.commandBus.execute<SynthesizeSpeechCommand, SpokenAudio>(
          new SynthesizeSpeechCommand({ organizationId: context.organizationId, text }),
        );
        const id = await this.sendAs(planned, text, context, {
          audio: spoken.data,
          seconds: spoken.seconds,
        });
        return promptText('whatsapp/tools.send-whatsapp-voice-note-done', {
          describeWhatsappTarget: describeWhatsappTarget(planned),
          accountLabel: planned.accountLabel,
          seconds: String(spoken.seconds),
          id,
        });
      },
    });
  }

  /**
   * A send that asks: the number and the chat planned once when the card is
   * raised, named as the subject a grant covers, and carried out to that
   * plan. Every send tool is one of these, so what a yes sends to is decided
   * in one place.
   */
  private askingSend(spec: AskingSendSpec): BotToolDefinition {
    return defineBotTool({
      name: spec.name,
      asks: true,
      sharesOutside: true,
      scope: 'whatsapp:write',
      description: spec.description,
      input: z.object({
        account: account.optional(),
        chat,
        text: spec.text,
        planned: plannedSend
          .optional()
          .describe(promptText('whatsapp/tools.send-whatsapp-message-planned')),
      }),
      normalize: async (input, context) => {
        await spec.ready?.(context.organizationId);
        return { ...input, planned: await this.plan(input, context.owner) };
      },
      subject: (input) => {
        const planned = plannedOf(input.planned);
        return {
          kind: 'whatsapp_chat',
          key: `${planned.accountId}:${planned.chatId}`,
          label: describeWhatsappTarget(planned),
        };
      },
      summarize: (input) => spec.summarize(plannedOf(input.planned), input.text),
      run: async (input, context) => {
        // Only a card's stored call carries a plan Oppenheimer made. A call
        // that runs without one (Full access, a grant for the chat) is the
        // model's own input, whose `planned` could name any chat: it is
        // resolved again here, the same way the grant was checked.
        const planned = context.approvalId
          ? plannedOf(input.planned)
          : await this.plan(input, context.owner);
        await spec.ready?.(context.organizationId);
        return spec.deliver(planned, input.text, context);
      },
    });
  }

  /** The send itself, as the bot, to the planned chat; answers WhatsApp's id. */
  private sendAs(
    planned: PlannedSend,
    text: string,
    context: BotToolCallContext,
    voice?: { audio: Buffer; seconds: number },
  ): Promise<string> {
    return this.commandBus.execute<SendWhatsappMessageCommand, string>(
      new SendWhatsappMessageCommand({
        scope: context.owner,
        accountId: planned.accountId,
        chat: { chatId: planned.chatId, chatKind: planned.chatKind, chatName: planned.chatName },
        text,
        botId: context.botId,
        ...(voice ? { voice } : {}),
      }),
    );
  }

  /** Refuses a voice note for a workspace with no provider to speak it. */
  private async requireSpeech(organizationId: string): Promise<void> {
    const speaks = await this.queryBus.execute<FindSpeechSynthesisQuery, boolean>(
      new FindSpeechSynthesisQuery(organizationId),
    );
    if (!speaks) throw new BotToolRefusal(promptText('whatsapp/tools.speech-not-set-up'));
  }

  /** The number and the chat a send means, resolved once so a yes sends where the card said. */
  private async plan(
    input: { account?: string; chat: string },
    owner: AccessScope,
  ): Promise<PlannedSend> {
    const chosen = await this.accounts.one(owner, input.account);
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
  if (!parsed.success) throw new BotToolRefusal(promptText('whatsapp/tools.planned-of'));
  return parsed.data;
}
