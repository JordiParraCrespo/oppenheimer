import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod/v4';
import { BotSubscriptionMapper } from '../bot-subscription.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../database/bot-subscription.repository.port';
import {
  BOT_SUBSCRIPTION_PURPOSE_MAX,
  BOT_SUBSCRIPTION_WAKE_LIMIT,
  BOT_SUBSCRIPTIONS_PER_BOT,
} from '../domain/bot-subscription.policy';
import { BotSessionWatchResolver } from './bot-session-watch.resolver';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/**
 * Following sessions (`27-bot-subscriptions.md` §3): watch one, stop
 * watching it, list what is watched. None asks: a watch only wakes the bot
 * when a session a person or an approved call started moves, it is bounded
 * by its task or the wake limit, and it can be undone. `start_session`
 * subscribes on its own.
 */
@Injectable()
export class BotWatchToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly watches: BotSessionWatchResolver,
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly mapper: BotSubscriptionMapper,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.watchSession(), this.unwatchSession(), this.listWatches()];
  }

  private watchSession(): BotToolDefinition {
    return defineBotTool({
      name: 'watch_session',
      scope: 'sessions:read',
      description: `Subscribes you to a session, so you are woken with a turn of your own when its task needs input, finishes, fails or is stopped: no need to check on it or to be asked. Sessions you start with start_session are watched already. until "task" (the default) follows the task running now, or the next one if none is; "closed" follows every task until the session is closed. At most ${BOT_SUBSCRIPTION_WAKE_LIMIT} wakes per watch and ${BOT_SUBSCRIPTIONS_PER_BOT} watched sessions.`,
      input: z.object({
        session_id: z.uuid().describe('The session to follow (from list_sessions).'),
        until: z
          .enum(['task', 'closed'])
          .optional()
          .describe('"task" (default): its current or next task; "closed": every task.'),
        purpose: z
          .string()
          .min(1)
          .max(BOT_SUBSCRIPTION_PURPOSE_MAX)
          .optional()
          .describe('Why you follow it, in a line; you are reminded of it when it wakes you.'),
      }),
      run: async (input, context) => {
        const { subscription, session } = await this.watches.watch(context, input.session_id, {
          until: input.until ?? 'task',
          purpose: input.purpose ?? null,
          from: 'now',
        });
        return this.mapper.toWatchAnswer(subscription, session);
      },
    });
  }

  private unwatchSession(): BotToolDefinition {
    return defineBotTool({
      name: 'unwatch_session',
      scope: 'sessions:read',
      description:
        'Stops following a session: it will no longer wake you. The session itself keeps running.',
      input: z.object({
        session_id: z.uuid().describe('A session you watch (from list_watches).'),
      }),
      run: async (input, context) => {
        const removed = await this.subscriptions.unsubscribe(
          context.organizationId,
          context.botId,
          input.session_id,
        );
        return removed
          ? `You no longer follow session ${input.session_id}.`
          : `You were not following session ${input.session_id}.`;
      },
    });
  }

  private listWatches(): BotToolDefinition {
    return defineBotTool({
      name: 'list_watches',
      scope: 'sessions:read',
      description:
        'Lists the sessions you follow: each one, why, until when, and how many times it woke you. Read a session itself with get_session.',
      input: z.object({}),
      run: async (_input, context) => {
        const watched = await this.subscriptions.findForBot(
          context.organizationId,
          context.botId,
          BOT_SUBSCRIPTIONS_PER_BOT,
        );
        if (!watched.length) return 'You follow no sessions.';
        return watched
          .map((subscription) => this.mapper.toListLine(subscription, context.timeZone))
          .join('\n');
      },
    });
  }
}
