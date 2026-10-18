import { Inject, Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import {
  BOT_DESCRIPTION_MAX,
  BOT_DOCUMENT_MAX,
  BOT_NAME_MAX,
  BOT_PERMISSIONS,
  BOT_PROVIDERS,
  type BotProvider,
} from '@oppenheimer/shared';
import { SESSION_EFFORTS } from '@oppenheimer/shared/agents';
import { z } from 'zod/v4';
import { CreateBotCommand } from '../../bots/commands/create-bot/create-bot.command';
import { DeleteBotCommand } from '../../bots/commands/delete-bot/delete-bot.command';
import type { BotEntity } from '../../bots/domain/bot.entity';
import type { BotGroupEntity } from '../../bots/domain/bot-group.entity';
import { BotErrors } from '../../bots/domain/bots.errors';
import type { ModelProviderCredentialEntity } from '../../bots/domain/model-provider-credential.entity';
import { FindBotQuery } from '../../bots/queries/find-bot/find-bot.query';
import { FindBotGroupsQuery } from '../../bots/queries/find-bot-groups/find-bot-groups.query';
import { FindBotsQuery } from '../../bots/queries/find-bots/find-bots.query';
import { FindModelProviderCredentialsQuery } from '../../bots/queries/find-model-provider-credentials/find-model-provider-credentials.query';
import {
  type BotCreationPlan,
  botCreatedAnswer,
  botCreationSummary,
  botDeletedAnswer,
  botDeletionSummary,
  type CreateBotInput,
  engineLabelOf,
  explicitCreateBotInput,
  planBotCreation,
} from '../bot-peer-tool.mapper';
import { BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import { botDeletionRefusal } from '../domain/bot-deletion.policy';
import { idempotencyKeyOf } from '../domain/bot-tool-idempotency.policy';
import { formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import { BotActorAbilityResolver } from './bot-actor-ability.resolver';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  type BotToolPolicy,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/** What `delete_bot` needs of the owner, as `DELETE /bots/:id` checks it. */
const DELETE_BOT_POLICY: BotToolPolicy = { action: 'delete', subject: 'Bot' };
/** A deletion is decided while the conversation that asked for it is fresh, or asked again. */
const DELETE_BOT_APPROVAL_TTL_MS = 15 * 60 * 1000;

interface DeleteBotInput {
  bot_id: string;
  name: string;
}

/**
 * Other bots (`25-bots.md` §4.6): which bots the workspace has and what each
 * is for, so a bot can point the person at the right one; `create_bot`,
 * which makes the person a new bot (it asks under Approve for me); and
 * `delete_bot`, which always asks, never on itself or a bot that is
 * answering. Asking and messaging bots come later, with the chain policy.
 */
@Injectable()
export class BotPeerToolsFactory implements BotToolArea {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    private readonly abilities: BotActorAbilityResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.listBots(), this.getBot(), this.createBot(), this.deleteBot()];
  }

  private deleteBot(): BotToolDefinition {
    return defineBotTool({
      name: 'delete_bot',
      scope: 'bots:write',
      asks: 'always',
      approvalTtlMs: DELETE_BOT_APPROVAL_TTL_MS,
      policy: DELETE_BOT_POLICY,
      description:
        "Deletes another of the workspace's bots for good, with its soul, instructions, memory and chat, once the person approves it on a card: it always asks, whatever your permission, and the card expires after 15 minutes. Use it only when the person asked for that bot to go. Name it by its id and its exact current name from list_bots; a name that does not match is refused. You cannot delete yourself, nor a bot that is answering right now.",
      input: z.strictObject({
        bot_id: z.uuid().describe('The bot to delete, by id from list_bots.'),
        name: z
          .string()
          .trim()
          .min(1)
          .max(BOT_NAME_MAX)
          .describe(
            'Its current name, exactly as list_bots shows it: the check that it is the bot you mean.',
          ),
      }),
      normalize: async (input, context) => {
        await this.deletable(input, context);
        return input;
      },
      summarize: async (input, context) => botDeletionSummary(await this.deletable(input, context)),
      run: async (input, context) => {
        // An approved call run again after it deleted the bot finds it gone: that is done, not failed.
        const retried = context.approvalId !== undefined && input.bot_id !== context.botId;
        if (retried && !(await this.findBot(context, input.bot_id))) {
          return botDeletedAnswer({ id: input.bot_id, name: input.name }, true);
        }
        const target = await this.deletable(input, context);
        await this.commandBus.execute<DeleteBotCommand, string>(
          new DeleteBotCommand({ scope: context.owner, botId: target.id }),
        );
        return botDeletedAnswer(target);
      },
    });
  }

  /**
   * The bot `input` names, read as the owner, once every rule of
   * `botDeletionRefusal` holds; a `BotToolRefusal` otherwise.
   */
  private async deletable(input: DeleteBotInput, context: BotToolCallContext): Promise<BotEntity> {
    const target =
      input.bot_id === context.botId ? null : await this.findBot(context, input.bot_id);
    const [active, ownerMayDelete] = target
      ? await Promise.all([
          this.turns.findForConversation(context.owner, target.id, []),
          this.abilities.may(context.organizationId, context.owner.userId, DELETE_BOT_POLICY, {
            id: target.id,
            organizationId: target.organizationId,
          }),
        ])
      : [[], false];
    const refusal = botDeletionRefusal(input, {
      selfId: context.botId,
      target,
      busy: active.length > 0,
      ownerMayDelete,
    });
    if (refusal || !target) throw new BotToolRefusal(refusal ?? 'Not done.');
    return target;
  }

  /** A bot of the owner's workspace by id; null when there is none. */
  private async findBot(context: BotToolCallContext, botId: string): Promise<BotEntity | null> {
    try {
      return await this.queryBus.execute<FindBotQuery, BotEntity>(
        new FindBotQuery({ scope: context.owner, botId }),
      );
    } catch (error) {
      if (error instanceof AppError && error.code === BotErrors.NOT_FOUND.code) return null;
      throw error;
    }
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

  private listBots(): BotToolDefinition {
    return defineBotTool({
      name: 'list_bots',
      scope: 'bots:read',
      description:
        "Lists the workspace's bots (you included, marked) with what each is for, its provider and model, and its home host. Use get_bot for one bot's details.",
      input: z.strictObject({}),
      run: async (_input, context) => {
        const bots = await this.queryBus.execute<FindBotsQuery, BotEntity[]>(
          new FindBotsQuery({ scope: context.owner }),
        );
        return formatToolList(
          'Bots',
          bots.map((bot) => summarizeBot(bot, context)),
          'The workspace has no bots.',
        );
      },
    });
  }

  private getBot(): BotToolDefinition {
    return defineBotTool({
      name: 'get_bot',
      scope: 'bots:read',
      description:
        "Reads one bot of the workspace: its name, what it is for, its provider and model, its home host and when its chat was last used. It does not read the bot's soul, instructions, memory or chat.",
      input: z.strictObject({ bot_id: z.uuid().describe('A bot id from list_bots.') }),
      run: async (input, context) => {
        const bot = await this.queryBus.execute<FindBotQuery, BotEntity>(
          new FindBotQuery({ scope: context.owner, botId: input.bot_id }),
        );
        return [
          `Bot ${bot.id} "${bot.name}"${bot.id === context.botId ? ' (you)' : ''}`,
          `- for: ${bot.description || '(no description)'}`,
          `- runs on: ${engineLabelOf(bot.provider, bot.model)}`,
          `- home host: ${bot.homeHostId ?? 'none chosen'}`,
          `- last message: ${formatToolTime(bot.lastMessageAt, context.timeZone)}`,
        ].join('\n');
      },
    });
  }
}

function summarizeBot(bot: BotEntity, context: BotToolCallContext): string {
  const you = bot.id === context.botId ? ' (you)' : '';
  const parts = [
    bot.description || 'no description',
    engineLabelOf(bot.provider, bot.model),
    `home host ${bot.homeHostId ?? 'none'}`,
  ];
  return `${bot.id} "${bot.name}"${you} [${parts.join('; ')}]`;
}
