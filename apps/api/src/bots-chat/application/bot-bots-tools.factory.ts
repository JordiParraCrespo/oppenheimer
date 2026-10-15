import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { BOT_PROVIDER_CATALOG, botModelOf } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { FindBotQuery } from '../../bots/queries/find-bot/find-bot.query';
import { FindBotsQuery } from '../../bots/queries/find-bots/find-bots.query';
import { formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  defineBotTool,
} from './bot-tool.factory';

/**
 * Other bots (`25-bots.md` §4.6), the reads: which bots the workspace has
 * and what each is for, so a bot can point the person at the right one.
 * Asking, messaging and creating bots come later, with the chain policy.
 */
@Injectable()
export class BotPeerToolsFactory implements BotToolArea {
  constructor(private readonly queryBus: QueryBus) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.listBots(), this.getBot()];
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
