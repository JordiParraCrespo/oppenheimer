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
  botProvidersOf,
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
import { NOT_ON_A_GITHUB_ASK } from '../domain/bot-github-ask.policy';
import { BOT_PEER_MESSAGES_PER_TURN } from '../domain/bot-peer-message.policy';
import { promptText } from '../domain/bot-prompt-text.policy';
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
 * Other bots: which bots the workspace has and what each
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
      description: promptText('bots/tools.message-bot', {
        peerMessagesPerTurn: String(BOT_PEER_MESSAGES_PER_TURN),
      }),
      input: peerMessageInput,
      run: (input, context) => this.send(input, context, false),
    });
  }

  private askBot(): BotToolDefinition {
    return defineBotTool({
      name: 'ask_bot',
      scope: 'bots:write',
      notOn: NOT_ON_A_GITHUB_ASK,
      description: promptText('bots/tools.ask-bot', {
        peerMessagesPerTurn: String(BOT_PEER_MESSAGES_PER_TURN),
      }),
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
        promptText('bots/tools.send-have-already-sent', {
          peerMessagesPerTurn: String(BOT_PEER_MESSAGES_PER_TURN),
        }),
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
      ? promptText('bots/tools.send-asked-answer-will', {
          botName: result.botName,
          botId: input.bot_id,
        })
      : promptText('bots/tools.send-sent-will-read', {
          botName: result.botName,
          botId: input.bot_id,
        });
  }

  private createBot(): BotToolDefinition {
    return defineBotTool({
      name: 'create_bot',
      scope: 'bots:write',
      asks: true,
      description: promptText('bots/tools.create-bot'),
      input: z.strictObject({
        name: z.string().trim().min(1).max(BOT_NAME_MAX).describe("The new bot's name."),
        description: z
          .string()
          .trim()
          .max(BOT_DESCRIPTION_MAX)
          .optional()
          .describe(promptText('bots/tools.bot-description')),
        soul: z
          .string()
          .max(BOT_DOCUMENT_MAX)
          .optional()
          .describe(promptText('bots/tools.create-bot-soul')),
        instructions: z
          .string()
          .max(BOT_DOCUMENT_MAX)
          .optional()
          .describe(promptText('bots/tools.create-bot-instructions')),
        provider: z
          .enum(BOT_PROVIDERS)
          .optional()
          .describe(promptText('bots/tools.create-bot-provider')),
        model: z
          .string()
          .min(1)
          .max(128)
          .nullable()
          .optional()
          .describe(promptText('bots/tools.create-bot-model')),
        effort: z
          .enum(SESSION_EFFORTS)
          .nullable()
          .optional()
          .describe(promptText('bots/tools.create-bot-effort')),
        permission: z
          .enum(BOT_PERMISSIONS)
          .optional()
          .describe(promptText('bots/tools.create-bot-permission')),
        group: z
          .string()
          .min(1)
          .max(80)
          .optional()
          .describe(promptText('bots/tools.create-bot-group')),
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
    const keyed = botProvidersOf(credentials.map((credential) => credential.provider));
    const plan = planBotCreation(input, creator, keyed, groups);
    if ('refusal' in plan) throw new BotToolRefusal(plan.refusal);
    return plan;
  }

  private updateBot(): BotToolDefinition {
    return defineBotTool({
      name: 'update_bot',
      scope: 'bots:write',
      asks: true,
      description: promptText('bots/tools.update-bot', { updateMax: String(BOT_UPDATE_MAX) }),
      input: z.strictObject({
        bot_ids: z
          .array(z.uuid())
          .min(1)
          .max(BOT_UPDATE_MAX)
          .describe(promptText('bots/tools.update-bot-bot-ids')),
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
          .describe(promptText('bots/tools.bot-description')),
        avatar_color: z
          .enum(BOT_AVATAR_COLORS)
          .optional()
          .describe(promptText('bots/tools.update-bot-avatar-color')),
        provider: z
          .enum(BOT_PROVIDERS)
          .optional()
          .describe(promptText('bots/tools.update-bot-provider')),
        model: z
          .string()
          .min(1)
          .max(128)
          .nullable()
          .optional()
          .describe(promptText('bots/tools.update-bot-model')),
        effort: z
          .enum(SESSION_EFFORTS)
          .nullable()
          .optional()
          .describe(promptText('bots/tools.create-bot-effort')),
        permission: z
          .enum(BOT_PERMISSIONS)
          .optional()
          .describe(promptText('bots/tools.update-bot-permission')),
        group: z
          .string()
          .min(1)
          .max(80)
          .nullable()
          .optional()
          .describe(promptText('bots/tools.update-bot-group')),
        learn_automatically: z
          .boolean()
          .optional()
          .describe(promptText('bots/tools.update-bot-learn-automatically')),
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
    if (!caller)
      throw new BotToolRefusal(promptText('bots/tools.update-plan-longer-one-workspaces'));
    const byId = new Map(all.map((bot) => [bot.id, bot]));
    const ids = [...new Set(input.bot_ids)];
    const unknown = ids.filter((id) => !byId.has(id));
    if (unknown.length) {
      throw new BotToolRefusal(
        promptText('bots/tools.update-plan-workspace-has-bot', { unknown: unknown.join(', ') }),
      );
    }
    const bots = ids.map((id) => byId.get(id) as BotEntity);
    const keyed = botProvidersOf(credentials.map((credential) => credential.provider));
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
      description: promptText('bots/tools.list-bots'),
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
      description: promptText('bots/tools.get-bot'),
      input: z.strictObject({ bot_id: z.uuid().describe('A bot id from list_bots.') }),
      run: async (input, context) => {
        const [bot, groups] = await Promise.all([
          this.queryBus.execute<FindBotQuery, BotEntity>(
            new FindBotQuery({ scope: context.owner, botId: input.bot_id }),
          ),
          this.groups(context),
        ]);
        return promptText('bots/tools.get-bot-bot-runs-provider', {
          id: bot.id,
          name: bot.name,
          id2: bot.id === context.botId ? ' (you)' : '',
          description: bot.description || '(no description)',
          engineLabel: engineLabelOf(bot.provider, bot.model),
          provider: bot.provider,
          model: bot.model ?? 'default',
          effort: bot.effort ?? 'default',
          permission: BOT_PERMISSION_LABELS[bot.permission],
          permission2: bot.permission,
          groupLabel: groupLabelOf(bot, groups),
          homeHostId: bot.homeHostId ?? 'none chosen',
          formatToolTime: formatToolTime(bot.lastMessageAt, context.timeZone),
        });
      },
    });
  }
}

/** How many bots one `update_bot` call may change. */
const BOT_UPDATE_MAX = 25;

const peerMessageInput = z.strictObject({
  bot_id: z.uuid().describe(promptText('bots/tools.peer-message-bot-id')),
  message: z
    .string()
    .trim()
    .min(1)
    .max(BOT_MESSAGE_MAX)
    .describe(promptText('bots/tools.peer-message-message')),
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
