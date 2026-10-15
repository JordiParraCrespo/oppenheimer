import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  BOT_DESCRIPTION_MAX,
  BOT_DOCUMENT_MAX,
  BOT_NAME_MAX,
  BOT_PERMISSIONS,
  BOT_PROVIDER_CATALOG,
  BOT_PROVIDERS,
  type BotProvider,
  botModelOf,
} from '@oppenheimer/shared';
import { SESSION_EFFORTS } from '@oppenheimer/shared/agents';
import { z } from 'zod/v4';
import { CreateBotCommand } from '../../bots/commands/create-bot/create-bot.command';
import type { BotEntity } from '../../bots/domain/bot.entity';
import type { BotGroupEntity } from '../../bots/domain/bot-group.entity';
import type { ModelProviderCredentialEntity } from '../../bots/domain/model-provider-credential.entity';
import { FindBotQuery } from '../../bots/queries/find-bot/find-bot.query';
import { FindBotGroupsQuery } from '../../bots/queries/find-bot-groups/find-bot-groups.query';
import { FindBotsQuery } from '../../bots/queries/find-bots/find-bots.query';
import { FindModelProviderCredentialsQuery } from '../../bots/queries/find-model-provider-credentials/find-model-provider-credentials.query';
import {
  type BotCreationPlan,
  botCreatedAnswer,
  botCreationSummary,
  type CreateBotInput,
  planBotCreation,
} from '../bot-peer-tool.mapper';
import { idempotencyKeyOf } from '../domain/bot-tool-idempotency.policy';
import { formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/**
 * Other bots (`25-bots.md` §4.6): which bots the workspace has and what each
 * is for, so a bot can point the person at the right one, and `create_bot`,
 * which makes the person a new bot (it asks under Approve for me). Asking and
 * messaging bots come later, with the chain policy.
 */
@Injectable()
export class BotPeerToolsFactory implements BotToolArea {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.listBots(), this.getBot(), this.createBot()];
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
          .optional()
          .describe(
            "A model id or label the provider offers; yours on the same provider, else the provider's default.",
          ),
        effort: z.enum(SESSION_EFFORTS).optional().describe('Only for a model that takes one.'),
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
            byBot: {
              creatorBotId: context.botId,
              idempotencyKey: idempotencyKeyOf(context.turnId, input, context.approvalId),
              model: plan.model,
              effort: plan.effort,
              permission: plan.permission,
              soul: plan.soul,
              instructions: plan.instructions,
            },
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
          `- runs on: ${engineOf(bot)}`,
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
    engineOf(bot),
    `home host ${bot.homeHostId ?? 'none'}`,
  ];
  return `${bot.id} "${bot.name}"${you} [${parts.join('; ')}]`;
}

function engineOf(bot: BotEntity): string {
  const model = botModelOf(bot.provider, bot.model);
  return `${BOT_PROVIDER_CATALOG[bot.provider].label} ${model?.label ?? bot.model ?? 'default model'}`;
}
