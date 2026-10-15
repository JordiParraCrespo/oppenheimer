import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  BOT_DESCRIPTION_MAX,
  BOT_DOCUMENT_MAX,
  BOT_MEMORY_FACT_MAX,
  BOT_MEMORY_FACTS_MAX,
  BOT_NAME_MAX,
  BOT_REVISION_NOTE_MAX,
  type BotDocumentName,
  botModelOf,
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
import { formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolContext,
  type BotToolDefinition,
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

/** The most facts one `recall` call returns. */
const RECALL_LIMIT_MAX = 25;

/**
 * Itself (`25-bots.md` §4.1): what the bot reads and changes about who it
 * is and what it remembers. Every tool acts on the turn's bot and nothing
 * else: the bot's id is the context's, never an input, so a bot cannot
 * read or edit another bot through these.
 */
@Injectable()
export class BotSelfToolsFactory implements BotToolArea {
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
    ];
  }

  private getSelf(): BotToolDefinition {
    return defineBotTool({
      name: 'get_self',
      scope: 'bots:read',
      description: `Reads your own profile, settings, SOUL.md and INSTRUCTIONS.md (with the revision each is at) and how many facts you remember. Each document is cut to ${DOCUMENT_PREVIEW_MAX} characters unless you name it in \`document\`; read it in full before edit_soul or edit_instructions, which need its revision. Use recall to read your memory.`,
      input: z.strictObject({
        document: z
          .enum(['soul', 'instructions'])
          .optional()
          .describe('Show only this document, in full, rather than both cut short.'),
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
        lines.push(`- memory: ${facts.length} of ${BOT_MEMORY_FACTS_MAX} facts (use recall)`);
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
        : 'your job and rules: what you do, for whom, and how';
    return defineBotTool({
      name: name === 'soul' ? 'edit_soul' : 'edit_instructions',
      scope: 'bots:write',
      description: `Rewrites your ${file} (${what}) with the whole new text, saved as a new revision the person can read and revert. Read it with get_self first and pass its revision as base_revision: if it changed since, nothing is saved and you read it again. At most ${BOT_DOCUMENT_MAX} characters. ${name === 'soul' ? 'Your job and rules go in edit_instructions.' : 'Your persona and tone go in edit_soul.'}`,
      input: z.strictObject({
        content: z
          .string()
          .max(BOT_DOCUMENT_MAX)
          .describe(`The whole new ${file}, in Markdown; it replaces the current text.`),
        base_revision: z
          .number()
          .int()
          .min(1)
          .describe(`The revision get_self showed for ${file}.`),
        note: z
          .string()
          .trim()
          .max(NOTE_MAX)
          .optional()
          .describe('Why you changed it, in a few words; shown in its history.'),
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
          return `${file} is unchanged: the text is what it already was, so no revision was made (still revision ${saved.revision}).`;
        }
        return `${file} saved as revision ${saved.revision} (${saved.content.length} characters). The person can see and revert it in Settings → Instructions.`;
      },
    });
  }

  private updateProfile(): BotToolDefinition {
    return defineBotTool({
      name: 'update_profile',
      scope: 'bots:write',
      description: `Changes your own name and/or description (what you are for, as the sidebar and other bots see it). Name 1 to ${BOT_NAME_MAX} characters, description at most ${BOT_DESCRIPTION_MAX}. Not a revision: the person sees it in the chat and changes it back in Settings → Profile. Persona and job go in edit_soul and edit_instructions.`,
      input: z
        .strictObject({
          name: z.string().trim().min(1).max(BOT_NAME_MAX).optional().describe('Your new name.'),
          description: z
            .string()
            .trim()
            .max(BOT_DESCRIPTION_MAX)
            .optional()
            .describe('One or two sentences on what you are for.'),
        })
        .refine((input) => input.name !== undefined || input.description !== undefined, {
          message: 'Give a name, a description, or both',
        }),
      run: async (input, context) => {
        const before = await this.bot(context);
        await this.commandBus.execute(
          new UpdateBotCommand({
            scope: context.owner,
            botId: context.botId,
            input: { name: input.name, description: input.description },
          }),
        );
        const after = await this.bot(context);
        const changes = [
          before.name !== after.name ? `name "${before.name}" → "${after.name}"` : null,
          before.description !== after.description
            ? `description "${before.description}" → "${after.description}"`
            : null,
        ].filter((change): change is string => change !== null);
        if (changes.length === 0) {
          return `Profile unchanged: name "${after.name}", description "${after.description}".`;
        }
        return `Profile saved: ${changes.join('; ')}.`;
      },
    });
  }

  private remember(): BotToolDefinition {
    return defineBotTool({
      name: 'remember',
      scope: 'bots:write',
      description: `Saves one fact to your memory, in a sentence of at most ${BOT_MEMORY_FACT_MAX} characters, for every later conversation. Only when "Learn automatically" is on in your settings; when it is off nothing is saved, and you ask the person in the chat first. Keep facts durable (preferences, names, decisions), one per call; you hold at most ${BOT_MEMORY_FACTS_MAX}, so forget one that no longer holds. Check recall first to avoid duplicates.`,
      input: z.strictObject({
        fact: z
          .string()
          .trim()
          .min(1)
          .max(BOT_MEMORY_FACT_MAX)
          .describe('The fact, as one self-contained sentence.'),
      }),
      run: async (input, context) => {
        const bot = await this.bot(context);
        if (!bot.learnAutomatically) {
          return `Not saved: "Learn automatically" is off for you, so remembering needs the person's OK. Ask them in the chat whether to remember: "${input.fact}". If they agree, they can add it in Settings → Memory or turn learning on.`;
        }
        const factId = await this.commandBus.execute<CreateBotMemoryFactCommand, string>(
          new CreateBotMemoryFactCommand({
            scope: context.owner,
            botId: context.botId,
            content: input.fact,
          }),
        );
        const saved = await this.queryBus.execute<FindBotMemoryFactQuery, BotMemoryFactEntity>(
          new FindBotMemoryFactQuery({ scope: context.owner, botId: context.botId, factId }),
        );
        return `Remembered ${saved.id}: "${saved.content}". The person can edit or delete it in Settings → Memory.`;
      },
    });
  }

  private forget(): BotToolDefinition {
    return defineBotTool({
      name: 'forget',
      scope: 'bots:write',
      description:
        'Deletes one fact from your memory, by its id from recall. It cannot be undone; the person sees what was forgotten in the chat. To correct a fact, forget it and remember the new one.',
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
      scope: 'bots:read',
      description: `Searches your memory for facts containing any of the words in \`query\`, best matches first; with no query, lists your newest facts. At most ${RECALL_LIMIT_MAX} per call. No match means you have no fact with those words, not that the thing is false.`,
      input: z.strictObject({
        query: z
          .string()
          .trim()
          .max(200)
          .optional()
          .describe('Words to look for, e.g. "deploy staging". Case does not matter.'),
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
              `${fact.id} "${fact.content}" [saved by ${fact.source === 'bot' ? 'you' : 'the person'}, ${formatToolTime(fact.updatedAt, context.timeZone)}]`,
          ),
          facts.length === 0
            ? 'Your memory is empty.'
            : `No fact contains any of those words (you hold ${facts.length}).`,
          {
            shown: shown.length,
            total: matches.length,
            hint: 'Use more specific words, or raise limit.',
          },
        );
      },
    });
  }

  private bot(context: BotToolContext): Promise<BotEntity> {
    return this.queryBus.execute<FindBotQuery, BotEntity>(
      new FindBotQuery({ scope: context.owner, botId: context.botId }),
    );
  }

  private facts(context: BotToolContext): Promise<BotMemoryFactEntity[]> {
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
    `- provider: ${bot.provider}; model: ${model?.label ?? bot.model ?? 'default'}${bot.effort ? `; effort: ${bot.effort}` : ''}`,
    `- approval level: ${bot.permission}`,
    `- learn automatically: ${bot.learnAutomatically ? 'on (remember saves directly)' : 'off (ask before remembering)'}`,
    `- home host: ${bot.homeHostId ?? 'none chosen'} (list_hosts names it)`,
  ];
}

function describeDocument(document: BotDocumentEntity, max: number | null): string[] {
  const file = DOCUMENT_FILES[document.name];
  const content = document.content;
  const cut = max !== null && content.length > max;
  return [
    `${file} (revision ${document.revision}, ${content.length} characters, last saved by ${document.updatedBy === 'bot' ? 'you' : 'the person'}):`,
    `<document name="${file}">`,
    content.length ? (cut ? content.slice(0, max) : content) : '(empty)',
    '</document>',
    ...(cut
      ? [
          `(${content.length - max} more characters cut; get_self with document "${document.name}" shows it in full.)`,
        ]
      : []),
  ];
}

function countHits(content: string, words: readonly string[]): number {
  const text = content.toLowerCase();
  return words.filter((word) => text.includes(word)).length;
}
