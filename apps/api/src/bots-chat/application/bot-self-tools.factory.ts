import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  BOT_DESCRIPTION_MAX,
  BOT_DOCUMENT_MAX,
  BOT_MEMORY_FACT_MAX,
  BOT_MEMORY_FACTS_MAX,
  BOT_MEMORY_TIERS,
  BOT_NAME_MAX,
  BOT_REVISION_NOTE_MAX,
  BOT_SECTIONS,
  type BotDocumentName,
  botModelOf,
  isReactionEmoji,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { CreateBotMemoryFactCommand } from '../../bots/commands/create-bot-memory-fact/create-bot-memory-fact.command';
import { DeleteBotMemoryFactCommand } from '../../bots/commands/delete-bot-memory-fact/delete-bot-memory-fact.command';
import { UpdateBotCommand } from '../../bots/commands/update-bot/update-bot.command';
import { UpdateBotDocumentCommand } from '../../bots/commands/update-bot-document/update-bot-document.command';
import type { BotEntity } from '../../bots/domain/bot.entity';
import type { BotDocumentEntity } from '../../bots/domain/bot-document.entity';
import type { BotMemoryFactEntity } from '../../bots/domain/bot-memory-fact.entity';
import { FindBotQuery } from '../../bots/queries/find-bot/find-bot.query';
import { FindBotDocumentQuery } from '../../bots/queries/find-bot-document/find-bot-document.query';
import { FindBotDocumentsQuery } from '../../bots/queries/find-bot-documents/find-bot-documents.query';
import { FindBotMemoryQuery } from '../../bots/queries/find-bot-memory/find-bot-memory.query';
import { FindBotMemoryFactQuery } from '../../bots/queries/find-bot-memory-fact/find-bot-memory-fact.query';
import { ReactAsBotCommand } from '../commands/react-as-bot/react-as-bot.command';
import type { ReactAsBotOutcome } from '../commands/react-as-bot/react-as-bot.command-handler';
import { describeBotAdvisor } from '../domain/bot-advisor.policy';
import {
  BOT_CHAT_SEARCH_LIMIT_MAX,
  searchWords,
  snippetAround,
} from '../domain/bot-chat-search.policy';
import { describeBotEffort } from '../domain/bot-effort.policy';
import {
  describeKept,
  memoryScopeOf,
  REMEMBER_DEFAULT_TIER,
  REMEMBER_DESCRIPTION,
  REMEMBER_MEMORY,
  REMEMBER_MEMORY_HINT,
  REMEMBER_TIER_HINT,
} from '../domain/bot-memory.policy';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import { promptText } from '../domain/bot-prompt-text.policy';
import { fenceUntrusted, formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import { SearchBotConversationQuery } from '../queries/search-bot-conversation/search-bot-conversation.query';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/** How a document is named to the model. */
const DOCUMENT_FILES: Record<BotDocumentName, string> = {
  soul: 'SOUL.md',
  instructions: 'INSTRUCTIONS.md',
};

/** How much of each document `get_self` shows when it is not asked for one in full. */
const DOCUMENT_PREVIEW_MAX = 4_000;

/**
 * What a revision note says when the bot wrote it. The revision's author
 * column is the owner's (the command writes as the caller), so the note is
 * where the history says the bot made the change.
 */
const BOT_NOTE_PREFIX = 'By the bot';
const NOTE_MAX = BOT_REVISION_NOTE_MAX - BOT_NOTE_PREFIX.length - 2;

/**
 * What the bot is told for each way its reaction did not land, one row per
 * outcome, so a new channel constraint is a row here, never a branch in the
 * tool. Each says why and what to do instead.
 */
const REACT_REFUSALS: Record<
  Exclude<ReactAsBotOutcome['kind'], 'reacted'>,
  (emoji: string) => string
> = {
  no_message: () => promptText('core/tools-self.react-no-message'),
  not_yours: () => promptText('core/tools-self.react-not-yours'),
  no_name: (emoji) => promptText('core/tools-self.react-no-name', { emoji }),
  working_sign: () => promptText('core/tools-self.react-working-sign'),
  unreachable: () => promptText('core/tools-self.react-unreachable'),
  unsupported: () => promptText('core/tools-self.react-unsupported'),
  no_channel: () => promptText('core/tools-self.react-not-sent'),
  not_sent: () => promptText('core/tools-self.react-not-sent'),
};

/** The most facts one `recall` call returns. */
const RECALL_LIMIT_MAX = 25;

/**
 * Itself: what the bot reads and changes about who it is and what it remembers.
 * Every tool acts on the turn's bot and nothing else: the bot's id is the
 * context's, never an input, so a bot cannot read or edit another bot through
 * these.
 */
@Injectable()
export class BotSelfToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'self' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.getSelf(),
      this.editDocument('soul'),
      this.editDocument('instructions'),
      this.updateProfile(),
      this.remember(),
      this.forget(),
      this.recall(),
      this.searchChat(),
      this.react(),
    ];
  }

  private getSelf(): BotToolDefinition {
    return defineBotTool({
      name: 'get_self',
      readOnly: true,
      scope: 'bots:read',
      description: promptText('core/tools-self.get-self', {
        documentPreviewMax: String(DOCUMENT_PREVIEW_MAX),
      }),
      input: z.strictObject({
        document: z
          .enum(['soul', 'instructions'])
          .optional()
          .describe(promptText('core/tools-self.get-self-document')),
      }),
      run: async (input, context) => {
        const [bot, documents, facts] = await Promise.all([
          this.bot(context),
          this.queryBus.execute<FindBotDocumentsQuery, BotDocumentEntity[]>(
            new FindBotDocumentsQuery({ scope: context.owner, botId: context.botId }),
          ),
          this.facts(context),
        ]);
        const lines = describeSelf(bot);
        lines.push(
          promptText('core/tools-self.get-self-memory-facts-use', {
            factsCount: String(facts.length),
            memoryFactsMax: String(BOT_MEMORY_FACTS_MAX),
          }),
        );
        for (const document of documents) {
          if (input.document && document.name !== input.document) continue;
          lines.push(
            '',
            ...describeDocument(document, input.document ? null : DOCUMENT_PREVIEW_MAX),
          );
        }
        return lines.join('\n');
      },
    });
  }

  private editDocument(name: BotDocumentName): BotToolDefinition {
    const file = DOCUMENT_FILES[name];
    const what =
      name === 'soul'
        ? 'your persona and tone'
        : promptText('core/tools-self.what-instructions-are');
    return defineBotTool({
      name: name === 'soul' ? 'edit_soul' : 'edit_instructions',
      scope: 'bots:write',
      setupStep:
        name === 'instructions'
          ? promptText('core/tools-self.write-instructions-setup-step')
          : undefined,
      description: promptText('core/tools-self.edit-document', {
        file,
        what,
        documentMax: String(BOT_DOCUMENT_MAX),
        name:
          name === 'soul'
            ? promptText('core/tools-self.rules-go-in-instructions')
            : promptText('core/tools-self.persona-goes-in-soul'),
      }),
      input: z.strictObject({
        content: z
          .string()
          .max(BOT_DOCUMENT_MAX)
          .describe(promptText('core/tools-self.edit-document-content', { file })),
        base_revision: z
          .number()
          .int()
          .min(1)
          .describe(promptText('core/tools-self.edit-document-base-revision', { file })),
        note: z
          .string()
          .trim()
          .max(NOTE_MAX)
          .optional()
          .describe(promptText('core/tools-self.edit-document-note')),
      }),
      run: async (input, context) => {
        await this.commandBus.execute(
          new UpdateBotDocumentCommand({
            scope: context.owner,
            botId: context.botId,
            name,
            input: {
              content: input.content,
              baseRevision: input.base_revision,
              note: input.note ? `${BOT_NOTE_PREFIX}: ${input.note}` : BOT_NOTE_PREFIX,
            },
          }),
        );
        const saved = await this.queryBus.execute<FindBotDocumentQuery, BotDocumentEntity>(
          new FindBotDocumentQuery({ scope: context.owner, botId: context.botId, name }),
        );
        if (saved.revision === input.base_revision) {
          return promptText('core/tools-self.edit-document-unchanged', {
            file,
            revision: String(saved.revision),
          });
        }
        return promptText('core/tools-self.edit-document-saved', {
          file,
          revision: String(saved.revision),
          contentCount: String(saved.content.length),
        });
      },
    });
  }

  private updateProfile(): BotToolDefinition {
    return defineBotTool({
      name: 'update_profile',
      scope: 'bots:write',
      setupStep: promptText('core/tools-self.update-profile-setup-step'),
      description: promptText('core/tools-self.update-profile', {
        nameMax: String(BOT_NAME_MAX),
        descriptionMax: String(BOT_DESCRIPTION_MAX),
      }),
      input: z
        .strictObject({
          name: z.string().trim().min(1).max(BOT_NAME_MAX).optional().describe('Your new name.'),
          description: z
            .string()
            .trim()
            .max(BOT_DESCRIPTION_MAX)
            .optional()
            .describe(promptText('core/tools-self.update-profile-description')),
          sections: z
            .array(z.enum(BOT_SECTIONS))
            .max(BOT_SECTIONS.length)
            .optional()
            .describe(promptText('core/tools-self.update-profile-sections')),
        })
        .refine(
          (input) =>
            input.name !== undefined ||
            input.description !== undefined ||
            input.sections !== undefined,
          { message: promptText('core/tools-self.update-profile-message') },
        ),
      run: async (input, context) => {
        const before = await this.bot(context);
        await this.commandBus.execute(
          new UpdateBotCommand({
            scope: context.owner,
            botId: context.botId,
            input: { name: input.name, description: input.description, sections: input.sections },
          }),
        );
        const after = await this.bot(context);
        const changes = [
          before.name !== after.name ? `name "${before.name}" → "${after.name}"` : null,
          before.description !== after.description
            ? `description "${before.description}" → "${after.description}"`
            : null,
          before.sections.join() !== after.sections.join()
            ? `sections [${before.sections.join(', ')}] → [${after.sections.join(', ')}]`
            : null,
        ].filter((change): change is string => change !== null);
        if (changes.length === 0) {
          return promptText('core/tools-self.update-profile-profile-unchanged-name', {
            name: after.name,
            description: after.description,
          });
        }
        return `Profile saved: ${changes.join('; ')}.`;
      },
    });
  }

  private remember(): BotToolDefinition {
    return defineBotTool({
      name: 'remember',
      scope: 'bots:write',
      setupStep: promptText('core/tools-self.remember-setup-step'),
      description: REMEMBER_DESCRIPTION,
      input: z.strictObject({
        fact: z
          .string()
          .trim()
          .min(1)
          .max(BOT_MEMORY_FACT_MAX)
          .describe(promptText('core/tools-self.remember-fact')),
        tier: z.enum(BOT_MEMORY_TIERS).optional().describe(REMEMBER_TIER_HINT),
        memory: z.enum(REMEMBER_MEMORY).optional().describe(REMEMBER_MEMORY_HINT),
      }),
      run: async (input, context) => {
        const bot = await this.bot(context);
        if (!bot.learnAutomatically) {
          return promptText('core/tools-self.remember-saved-learn-automatically', {
            fact: input.fact,
          });
        }
        const factId = await this.commandBus.execute<CreateBotMemoryFactCommand, string>(
          new CreateBotMemoryFactCommand({
            scope: context.owner,
            botId: context.botId,
            content: input.fact,
            tier: input.tier ?? REMEMBER_DEFAULT_TIER,
            memoryScope: memoryScopeOf(input.memory),
            author: 'bot',
          }),
        );
        const saved = await this.queryBus.execute<FindBotMemoryFactQuery, BotMemoryFactEntity>(
          new FindBotMemoryFactQuery({ scope: context.owner, botId: context.botId, factId }),
        );
        return promptText('core/tools-self.remember-remembered-person-can', {
          id: saved.id,
          describeKept: describeKept(saved),
          content: saved.content,
        });
      },
    });
  }

  private forget(): BotToolDefinition {
    return defineBotTool({
      name: 'forget',
      scope: 'bots:write',
      description: promptText('core/tools-self.forget'),
      input: z.strictObject({ fact_id: z.uuid().describe('A fact id from recall.') }),
      run: async (input, context) => {
        const fact = await this.queryBus.execute<FindBotMemoryFactQuery, BotMemoryFactEntity>(
          new FindBotMemoryFactQuery({
            scope: context.owner,
            botId: context.botId,
            factId: input.fact_id,
          }),
        );
        await this.commandBus.execute(
          new DeleteBotMemoryFactCommand({
            scope: context.owner,
            botId: context.botId,
            factId: fact.id,
          }),
        );
        return `Forgot ${fact.id}: "${fact.content}".`;
      },
    });
  }

  private recall(): BotToolDefinition {
    return defineBotTool({
      name: 'recall',
      readOnly: true,
      scope: 'bots:read',
      description: promptText('core/tools-self.recall', {
        recallLimitMax: String(RECALL_LIMIT_MAX),
      }),
      input: z.strictObject({
        query: z
          .string()
          .trim()
          .max(200)
          .optional()
          .describe(promptText('core/tools-self.recall-query')),
        limit: z.number().int().min(1).max(RECALL_LIMIT_MAX).default(10),
      }),
      run: async (input, context) => {
        const facts = await this.facts(context);
        const words = (input.query ?? '')
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => word.length > 0);
        const matches = words.length
          ? facts
              .map((fact, order) => ({ fact, order, hits: countHits(fact.content, words) }))
              .filter((match) => match.hits > 0)
              .sort((a, b) => b.hits - a.hits || a.order - b.order)
              .map((match) => match.fact)
          : facts;
        const shown = matches.slice(0, input.limit);
        return formatToolList(
          words.length ? `Facts matching "${input.query}"` : 'Your newest facts',
          shown.map(
            (fact) =>
              `${fact.id} "${fact.content}" [${describeKept(fact, context.botId)}; saved by ${fact.source === 'bot' ? 'a bot' : 'the person'}, ${formatToolTime(fact.updatedAt, context.timeZone)}]`,
          ),
          facts.length === 0
            ? 'Your memory is empty.'
            : promptText('core/tools-self.recall-fact-contains-any', {
                factsCount: String(facts.length),
              }),
          {
            shown: shown.length,
            total: matches.length,
            hint: promptText('core/tools-self.recall-hint'),
          },
        );
      },
    });
  }

  private bot(context: BotToolCallContext): Promise<BotEntity> {
    return this.queryBus.execute<FindBotQuery, BotEntity>(
      new FindBotQuery({ scope: context.owner, botId: context.botId }),
    );
  }

  /**
   * This chat's past messages, searched: a turn reads a token budget of history
   * and a summary of the rest, so what fell out of both is found here, in the
   * person's and the bot's own words.
   */
  /**
   * A reaction to the person's message, as a person leaves one: shown on
   * their bubble in the console chat, and on Slack and WhatsApp on the
   * message there (`ReactAsBotCommandHandler`). Where it cannot land, the
   * tool says why and to answer in words.
   */
  private react(): BotToolDefinition {
    return defineBotTool({
      name: 'react',
      scope: 'bots:write',
      description: promptText('core/tools-self.react'),
      input: z.strictObject({
        emoji: z.string().trim().max(32).describe(promptText('core/tools-self.react-emoji')),
        message_id: z.uuid().optional().describe(promptText('core/tools-self.react-message-id')),
      }),
      run: async (input, context) => {
        const emoji = input.emoji === '' ? null : input.emoji;
        if (emoji !== null && !isReactionEmoji(emoji)) {
          throw new BotToolRefusal(promptText('core/tools-self.react-not-emoji', { emoji }));
        }
        const outcome = await this.commandBus.execute<ReactAsBotCommand, ReactAsBotOutcome>(
          new ReactAsBotCommand({
            scope: context.owner,
            organizationId: context.organizationId,
            botId: context.botId,
            conversationId: context.conversationId,
            turnId: context.turnId,
            messageId: input.message_id ?? null,
            emoji,
          }),
        );
        if (outcome.kind !== 'reacted') {
          throw new BotToolRefusal(REACT_REFUSALS[outcome.kind](emoji ?? ''));
        }
        return emoji
          ? promptText('core/tools-self.react-done', { emoji, messageId: outcome.messageId })
          : promptText('core/tools-self.react-removed', { messageId: outcome.messageId });
      },
    });
  }

  private searchChat(): BotToolDefinition {
    return defineBotTool({
      name: 'search_chat',
      readOnly: true,
      scope: 'bots:read',
      description: promptText('core/tools-self.search-chat', {
        chatSearchLimitMax: String(BOT_CHAT_SEARCH_LIMIT_MAX),
      }),
      input: z.strictObject({
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe(promptText('core/tools-self.search-chat-query')),
        limit: z.number().int().min(1).max(BOT_CHAT_SEARCH_LIMIT_MAX).default(10),
      }),
      run: async (input, context) => {
        const messages = await this.queryBus.execute<
          SearchBotConversationQuery,
          BotMessageEntity[]
        >(
          new SearchBotConversationQuery(
            context.owner,
            context.conversationId,
            input.query,
            input.limit,
          ),
        );
        if (messages.length === 0) {
          return promptText('core/tools-self.search-chat-message-chat-matches', {
            query: input.query,
          });
        }
        const words = searchWords(input.query);
        const lines = messages.map(
          (message) =>
            `- ${message.id} [${formatToolTime(message.createdAt, context.timeZone)}] ${message.role === 'user' ? 'the person' : 'you'}: ${snippetAround(message.content, words)}`,
        );
        return [
          promptText('core/tools-self.search-chat-messages-matching-best', {
            query: input.query,
            messagesCount: String(messages.length),
          }),
          fenceUntrusted('chat_search', lines.join('\n')),
        ].join('\n');
      },
    });
  }

  private facts(context: BotToolCallContext): Promise<BotMemoryFactEntity[]> {
    return this.queryBus.execute<FindBotMemoryQuery, BotMemoryFactEntity[]>(
      new FindBotMemoryQuery({ scope: context.owner, botId: context.botId }),
    );
  }
}

function describeSelf(bot: BotEntity): string[] {
  const model = botModelOf(bot.provider, bot.model);
  return [
    `You: ${bot.id} "${bot.name}"`,
    `- description: ${bot.description || '(none)'}`,
    `- provider: ${bot.provider}; model: ${model?.label ?? bot.model ?? 'default'}; effort: ${describeBotEffort(bot)}`,
    `- advisor: ${describeBotAdvisor(bot)}`,
    `- approval level: ${bot.permission}`,
    `- learn automatically: ${bot.learnAutomatically ? promptText('core/tools-self.describe-self-remember-saves-directly') : promptText('core/tools-self.describe-self-off-ask-before')}`,
    promptText('core/tools-self.describe-self-home-host-list', {
      homeHostId: bot.homeHostId ?? 'none chosen',
    }),
    `- shows in: ${bot.sections.length ? bot.sections.join(', ') : 'Employees only'}`,
  ];
}

function describeDocument(document: BotDocumentEntity, max: number | null): string[] {
  const file = DOCUMENT_FILES[document.name];
  const content = document.content;
  const cut = max !== null && content.length > max;
  return [
    promptText('core/tools-self.document-header', {
      file,
      revision: String(document.revision),
      contentCount: String(content.length),
      updatedBy: document.updatedBy === 'bot' ? 'you' : 'the person',
    }),
    `<document name="${file}">`,
    content.length ? (cut ? content.slice(0, max) : content) : '(empty)',
    '</document>',
    ...(cut
      ? [
          promptText('core/tools-self.describe-document-more-characters-cut', {
            contentCount: String(content.length - max),
            name: document.name,
          }),
        ]
      : []),
  ];
}

function countHits(content: string, words: readonly string[]): number {
  const text = content.toLowerCase();
  return words.filter((word) => text.includes(word)).length;
}
