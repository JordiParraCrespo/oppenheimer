import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import {
  BOT_AVATAR_COLORS,
  BOT_DESCRIPTION_MAX,
  BOT_DOCUMENT_MAX,
  BOT_MESSAGE_MAX,
  BOT_NAME_MAX,
  BOT_PERMISSIONS,
  BOT_PROVIDERS,
  type BotProvider,
} from '@oppenheimer/shared';
import { SESSION_EFFORTS } from '@oppenheimer/shared/agents';
import { z } from 'zod/v4';
import { CreateBotCommand } from '../../bots/commands/create-bot/create-bot.command';
import { UpdateBotCommand } from '../../bots/commands/update-bot/update-bot.command';
import type { BotEntity } from '../../bots/domain/bot.entity';
import type { BotGroupEntity } from '../../bots/domain/bot-group.entity';
import type { ModelProviderCredentialEntity } from '../../bots/domain/model-provider-credential.entity';
import { FindBotQuery } from '../../bots/queries/find-bot/find-bot.query';
import { FindBotGroupsQuery } from '../../bots/queries/find-bot-groups/find-bot-groups.query';
import { FindBotsQuery } from '../../bots/queries/find-bots/find-bots.query';
import { FindModelProviderCredentialsQuery } from '../../bots/queries/find-model-provider-credentials/find-model-provider-credentials.query';
import {
  BOT_PERMISSION_LABELS,
  type BotCreationPlan,
  botCreatedAnswer,
  botCreationSummary,
  type CreateBotInput,
  engineLabelOf,
  explicitCreateBotInput,
  planBotCreation,
} from '../bot-peer-tool.mapper';
import {
  SendBotPeerMessageCommand,
  type SendBotPeerMessageResult,
} from '../commands/send-bot-peer-message/send-bot-peer-message.command';
import { BOT_PEER_MESSAGES_PER_TURN } from '../domain/bot-peer-message.policy';
import { idempotencyKeyOf } from '../domain/bot-tool-idempotency.policy';
import { formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';
import {
  type BotUpdateFailure,
  type BotUpdatePlan,
  botsUpdatedAnswer,
  botUpdateSummary,
  planBotUpdate,
  type UpdateBotsInput,
} from './bot-update.policy';

/**
 * Other bots (`25-bots.md` §4.6): which bots the workspace has and what each
 * is for, so a bot can point the person at the right one; `message_bot` and
 * `ask_bot`, which hand another bot a message as a queued turn of its own
 * (the answer to an ask comes back the same way, never by waiting); and
 * `create_bot`, which makes the person a new bot, and `update_bot`, which
 * changes existing ones, several at once (both ask under Approve for me).
 */
@Injectable()
export class BotPeerToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'bots' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.listBots(),
      this.getBot(),
      this.messageBot(),
      this.askBot(),
      this.createBot(),
      this.updateBot(),
    ];
  }

  private messageBot(): BotToolDefinition {
    return defineBotTool({
      name: 'message_bot',
      scope: 'bots:write',
      description: `Sends another of the person's bots a message without waiting for an answer: a heads-up, a hand-off, or something it should act on in its own job. It reads it as its next turn after the person's own messages, marked as from you; nothing it writes comes back to you. Use ask_bot instead when you need its answer, and list_bots for its id. It does not see this chat, so say everything it needs. At most ${BOT_PEER_MESSAGES_PER_TURN} messages to other bots a turn, and never a token, key or password.`,
      input: peerMessageInput,
      run: (input, context) => this.send(input, context, false),
    });
  }

  private askBot(): BotToolDefinition {
    return defineBotTool({
      name: 'ask_bot',
      scope: 'bots:write',
      description: `Asks another of the person's bots a question, or gives it a task, and gets its answer back: when it has finished, its answer arrives in this chat as a new message from Oppenheimer and you carry on from there. You do not wait for it in this turn: after asking, tell the person in a sentence what you asked and of whom, and end your turn unless other work is left. It does not see this chat, so say everything it needs. Use list_bots for its id. At most ${BOT_PEER_MESSAGES_PER_TURN} messages to other bots a turn, and never a token, key or password.`,
      input: peerMessageInput,
      run: (input, context) => this.send(input, context, true),
    });
  }

  /** `message_bot` and `ask_bot`: the message as a turn of the other bot, or the refusal as the tool's answer. */
  private async send(
    input: z.output<typeof peerMessageInput>,
    context: BotToolCallContext,
    expectsReply: boolean,
  ): Promise<string> {
    if (!context.budget.take('bot_messages', BOT_PEER_MESSAGES_PER_TURN)) {
      throw new BotToolRefusal(
        `You have already sent ${BOT_PEER_MESSAGES_PER_TURN} messages to other bots this turn, the most one turn may send. Finish with what you have.`,
      );
    }
    const result = await this.commandBus.execute<
      SendBotPeerMessageCommand,
      SendBotPeerMessageResult
    >(
      new SendBotPeerMessageCommand({
        owner: context.owner,
        organizationId: context.organizationId,
        fromTurnId: context.turnId,
        fromBotId: context.botId,
        toBotId: input.bot_id,
        content: input.message,
        expectsReply,
      }),
    );
    if (!result.sent) throw new BotToolRefusal(result.refusal);
    return expectsReply
      ? `Asked ${result.botName} (${input.bot_id}). Its answer will arrive in this chat as a new message once it has finished; do not ask again or wait for it now.`
      : `Sent to ${result.botName} (${input.bot_id}). It will read it after the person's own messages to it; it will not reply to you.`;
  }

  private createBot(): BotToolDefinition {
    return defineBotTool({
      name: 'create_bot',
      scope: 'bots:write',
      asks: true,
      description:
        'Creates a new bot for the person, marked as created by you: its name, what it is for, its soul (persona and tone) and instructions (its job and rules), and what runs it. The provider and model default to yours; only a provider the workspace has a key for is accepted. Its permission defaults to Approve for me and is never looser than yours. It can go in an existing group (by name or id from the sidebar); you cannot create groups. Use list_bots first so you do not make a second bot for the same job.',
      input: z.strictObject({
        name: z.string().trim().min(1).max(BOT_NAME_MAX).describe("The new bot's name."),
        description: z
          .string()
          .trim()
          .max(BOT_DESCRIPTION_MAX)
          .optional()
          .describe('What it is for, in a sentence.'),
        soul: z
          .string()
          .max(BOT_DOCUMENT_MAX)
          .optional()
          .describe(
            'Its SOUL.md, in Markdown: who it is and how it speaks. A template that says its name when omitted.',
          ),
        instructions: z
          .string()
          .max(BOT_DOCUMENT_MAX)
          .optional()
          .describe('Its INSTRUCTIONS.md, in Markdown: its job and rules. Empty when omitted.'),
        provider: z.enum(BOT_PROVIDERS).optional().describe('Who answers it; yours when omitted.'),
        model: z
          .string()
          .min(1)
          .max(128)
          .nullable()
          .optional()
          .describe(
            "A model id or label the provider offers; yours on the same provider when omitted, else the provider's default (also null).",
          ),
        effort: z
          .enum(SESSION_EFFORTS)
          .nullable()
          .optional()
          .describe("Only for a model that takes one; null is the model's own default."),
        permission: z
          .enum(BOT_PERMISSIONS)
          .optional()
          .describe(
            'auto (Approve for me) or full (Full access); never looser than yours. auto when omitted.',
          ),
        group: z
          .string()
          .min(1)
          .max(80)
          .optional()
          .describe('An existing bot group, by name or id; ungrouped when omitted.'),
      }),
      normalize: async (input, context) =>
        explicitCreateBotInput(input, await this.plan(input, context)),
      summarize: async (input, context) => {
        const plan = await this.plan(input, context);
        return botCreationSummary(input.name, plan);
      },
      run: async (input, context) => {
        const plan = await this.plan(input, context);
        const botId = await this.commandBus.execute<CreateBotCommand, string>(
          new CreateBotCommand({
            scope: context.owner,
            input: plan.body,
            model: plan.model,
            effort: plan.effort,
            permission: plan.permission,
            soul: plan.soul,
            instructions: plan.instructions,
            creatorBotId: context.botId,
            idempotencyKey: idempotencyKeyOf(context.turnId, input, context.approvalId),
            credentialScopes: context.credentialScopes,
          }),
        );
        const bot = await this.queryBus.execute<FindBotQuery, BotEntity>(
          new FindBotQuery({ scope: context.owner, botId }),
        );
        return botCreatedAnswer(bot, plan.groupName);
      },
    });
  }

  /** The bot to create, read as the owner: the creator, the keyed providers, the groups. */
  private async plan(input: CreateBotInput, context: BotToolCallContext): Promise<BotCreationPlan> {
    const [creator, credentials, groups] = await Promise.all([
      this.queryBus.execute<FindBotQuery, BotEntity>(
        new FindBotQuery({ scope: context.owner, botId: context.botId }),
      ),
      this.queryBus.execute<FindModelProviderCredentialsQuery, ModelProviderCredentialEntity[]>(
        new FindModelProviderCredentialsQuery(context.owner),
      ),
      input.group
        ? this.queryBus.execute<FindBotGroupsQuery, BotGroupEntity[]>(
            new FindBotGroupsQuery({ scope: context.owner }),
          )
        : Promise.resolve([]),
    ]);
    const keyed: BotProvider[] = credentials.map((credential) => credential.provider);
    const plan = planBotCreation(input, creator, keyed, groups);
    if ('refusal' in plan) throw new BotToolRefusal(plan.refusal);
    return plan;
  }

  private updateBot(): BotToolDefinition {
    return defineBotTool({
      name: 'update_bot',
      scope: 'bots:write',
      asks: true,
      description: `Changes the settings of one or more of the person's bots (you included) in one call: what runs them (provider, model and effort), their permission, their group, their name, description and avatar colour, and whether they save what they learn without asking. Give every bot the change applies to in bot_ids (from list_bots), at most ${BOT_UPDATE_MAX}; a field left out stays as it is. A model is an id or label of the bot's provider (the one named here, else each bot's own); a provider needs a workspace key. Permission is never looser than yours; a rename goes to one bot at a time; you cannot create groups. It does not edit a bot's soul or instructions.`,
      input: z.strictObject({
        bot_ids: z
          .array(z.uuid())
          .min(1)
          .max(BOT_UPDATE_MAX)
          .describe('The bots to change, from list_bots.'),
        name: z
          .string()
          .trim()
          .min(1)
          .max(BOT_NAME_MAX)
          .optional()
          .describe('A new name; one bot only.'),
        description: z
          .string()
          .trim()
          .max(BOT_DESCRIPTION_MAX)
          .optional()
          .describe('What it is for, in a sentence.'),
        avatar_color: z
          .enum(BOT_AVATAR_COLORS)
          .optional()
          .describe('The colour its face is drawn in.'),
        provider: z
          .enum(BOT_PROVIDERS)
          .optional()
          .describe(
            "Who answers them; switching provider without a model runs that provider's default.",
          ),
        model: z
          .string()
          .min(1)
          .max(128)
          .nullable()
          .optional()
          .describe("A model id or label the provider offers; null is the provider's default."),
        effort: z
          .enum(SESSION_EFFORTS)
          .nullable()
          .optional()
          .describe("Only for a model that takes one; null is the model's own default."),
        permission: z
          .enum(BOT_PERMISSIONS)
          .optional()
          .describe('auto (Approve for me) or full (Full access); never looser than yours.'),
        group: z
          .string()
          .min(1)
          .max(80)
          .nullable()
          .optional()
          .describe('An existing bot group, by name or id; null takes them out of their group.'),
        learn_automatically: z
          .boolean()
          .optional()
          .describe('Whether what they decide to remember is saved without asking.'),
      }),
      // The card stores the group by id, so a rename while it waits cannot
      // send the bots to another group of the old name.
      normalize: async (input, context) => {
        const plan = await this.updatePlan(input, context);
        const groupId = plan.steps[0]?.body.groupId;
        return {
          ...input,
          bot_ids: plan.steps.map((step) => step.bot.id),
          ...(typeof groupId === 'string' ? { group: groupId } : {}),
        };
      },
      summarize: async (input, context) =>
        botUpdateSummary(input, await this.updatePlan(input, context)),
      run: async (input, context) => {
        const plan = await this.updatePlan(input, context);
        // One write per bot, through the console's own command: a bot that
        // fails (deleted since the plan) is named beside the ones changed,
        // never hidden behind a bare error.
        const failed: BotUpdateFailure[] = [];
        const changed: string[] = [];
        for (const step of plan.steps) {
          try {
            await this.commandBus.execute(
              new UpdateBotCommand({ scope: context.owner, botId: step.bot.id, input: step.body }),
            );
            changed.push(step.bot.id);
          } catch (error) {
            failed.push({ bot: step.bot, reason: reasonOf(error) });
          }
        }
        if (changed.length === 0) throw new BotToolRefusal(botsUpdatedAnswer([], failed));
        const updated = await Promise.all(
          changed.map((botId) =>
            this.queryBus.execute<FindBotQuery, BotEntity>(
              new FindBotQuery({ scope: context.owner, botId }),
            ),
          ),
        );
        return botsUpdatedAnswer(updated, failed);
      },
    });
  }

  /** The change to each bot, read as the owner: the caller, the bots, the keyed providers, the groups. */
  private async updatePlan(
    input: UpdateBotsInput,
    context: BotToolCallContext,
  ): Promise<BotUpdatePlan> {
    const [all, credentials, groups] = await Promise.all([
      this.queryBus.execute<FindBotsQuery, BotEntity[]>(
        new FindBotsQuery({ scope: context.owner }),
      ),
      input.provider
        ? this.queryBus.execute<FindModelProviderCredentialsQuery, ModelProviderCredentialEntity[]>(
            new FindModelProviderCredentialsQuery(context.owner),
          )
        : Promise.resolve([]),
      input.group
        ? this.queryBus.execute<FindBotGroupsQuery, BotGroupEntity[]>(
            new FindBotGroupsQuery({ scope: context.owner }),
          )
        : Promise.resolve([]),
    ]);
    const caller = all.find((bot) => bot.id === context.botId);
    if (!caller) throw new BotToolRefusal('You are no longer one of the workspace’s bots.');
    const byId = new Map(all.map((bot) => [bot.id, bot]));
    const ids = [...new Set(input.bot_ids)];
    const unknown = ids.filter((id) => !byId.has(id));
    if (unknown.length) {
      throw new BotToolRefusal(
        `The workspace has no bot ${unknown.join(', ')}. Use list_bots for their ids.`,
      );
    }
    const bots = ids.map((id) => byId.get(id) as BotEntity);
    const keyed: BotProvider[] = credentials.map((credential) => credential.provider);
    const plan = planBotUpdate(input, caller, bots, keyed, groups);
    if ('refusal' in plan) throw new BotToolRefusal(plan.refusal);
    return plan;
  }

  /** The owner's bot groups, which name the group each bot is in. */
  private groups(context: BotToolCallContext): Promise<BotGroupEntity[]> {
    return this.queryBus.execute<FindBotGroupsQuery, BotGroupEntity[]>(
      new FindBotGroupsQuery({ scope: context.owner }),
    );
  }

  private listBots(): BotToolDefinition {
    return defineBotTool({
      name: 'list_bots',
      readOnly: true,
      scope: 'bots:read',
      description:
        "Lists the workspace's bots (you included, marked) with what each is for, its sidebar group, its provider and model, and its home host. Use get_bot for one bot's details.",
      input: z.strictObject({}),
      run: async (_input, context) => {
        const [bots, groups] = await Promise.all([
          this.queryBus.execute<FindBotsQuery, BotEntity[]>(
            new FindBotsQuery({ scope: context.owner }),
          ),
          this.groups(context),
        ]);
        return formatToolList(
          'Bots',
          bots.map((bot) => summarizeBot(bot, context, groups)),
          'The workspace has no bots.',
        );
      },
    });
  }

  private getBot(): BotToolDefinition {
    return defineBotTool({
      name: 'get_bot',
      readOnly: true,
      scope: 'bots:read',
      description:
        "Reads one bot of the workspace: its name, what it is for, its provider and model, its home host and when its chat was last used. It does not read the bot's soul, instructions, memory or chat.",
      input: z.strictObject({ bot_id: z.uuid().describe('A bot id from list_bots.') }),
      run: async (input, context) => {
        const [bot, groups] = await Promise.all([
          this.queryBus.execute<FindBotQuery, BotEntity>(
            new FindBotQuery({ scope: context.owner, botId: input.bot_id }),
          ),
          this.groups(context),
        ]);
        return [
          `Bot ${bot.id} "${bot.name}"${bot.id === context.botId ? ' (you)' : ''}`,
          `- for: ${bot.description || '(no description)'}`,
          `- runs on: ${engineLabelOf(bot.provider, bot.model)} (provider ${bot.provider}, model ${bot.model ?? 'default'}, effort ${bot.effort ?? 'default'})`,
          `- permission: ${BOT_PERMISSION_LABELS[bot.permission]} (${bot.permission})`,
          `- group: ${groupLabelOf(bot, groups)}`,
          `- home host: ${bot.homeHostId ?? 'none chosen'}`,
          `- last message: ${formatToolTime(bot.lastMessageAt, context.timeZone)}`,
        ].join('\n');
      },
    });
  }
}

/** How many bots one `update_bot` call may change. */
const BOT_UPDATE_MAX = 25;

const peerMessageInput = z.strictObject({
  bot_id: z.uuid().describe('The other bot, from list_bots. Not yourself.'),
  message: z
    .string()
    .trim()
    .min(1)
    .max(BOT_MESSAGE_MAX)
    .describe('What you are telling or asking it, complete on its own: it does not see this chat.'),
});

function summarizeBot(
  bot: BotEntity,
  context: BotToolCallContext,
  groups: readonly BotGroupEntity[],
): string {
  const you = bot.id === context.botId ? ' (you)' : '';
  const parts = [
    bot.description || 'no description',
    `group ${groupLabelOf(bot, groups)}`,
    engineLabelOf(bot.provider, bot.model),
    `home host ${bot.homeHostId ?? 'none'}`,
  ];
  return `${bot.id} "${bot.name}"${you} [${parts.join('; ')}]`;
}

/** `"Web" (id)`, or `ungrouped`. */
function groupLabelOf(bot: BotEntity, groups: readonly BotGroupEntity[]): string {
  if (!bot.groupId) return 'ungrouped';
  const group = groups.find((candidate) => candidate.id === bot.groupId);
  return group ? `"${group.name}" (${group.id})` : bot.groupId;
}

/** Why a write failed, in the words its error carries. */
function reasonOf(error: unknown): string {
  if (error instanceof AppError) return error.detail ?? error.title;
  return error instanceof Error ? error.message : 'it could not be saved';
}
