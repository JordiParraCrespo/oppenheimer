import { Inject, Injectable } from '@nestjs/common';
import { TERMINAL_WATCH_PATTERN_MAX } from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import {
  describePatternWatch,
  describeWatch,
  describeWatchStarted,
} from '../bot-watch-tool.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../database/bot-subscription.repository.port';
import { promptText } from '../domain/bot-prompt-text.policy';
import {
  BOT_SESSION_WAIT_MAX_SECONDS,
  BOT_SESSION_WAITS_PER_TURN,
} from '../domain/bot-session-wait.policy';
import {
  BOT_CHECK_IN_MINUTES,
  BOT_SUBSCRIPTION_PURPOSE_MAX,
  BOT_SUBSCRIPTION_WAKE_LIMIT,
  BOT_SUBSCRIPTIONS_PER_BOT,
  checkInAnswer,
  liveTaskOf,
} from '../domain/bot-subscription.policy';
import { BotSessionWaitResolver } from './bot-session-wait.resolver';
import { BotSessionWatchResolver } from './bot-session-watch.resolver';
import {
  type BotToolArea,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/**
 * Following sessions: watch one, stop watching it, list what is watched, or
 * wait on one inside the turn, a bounded `wait_for_session`. None asks: a watch
 * only wakes the bot when a session a person or an approved call started moves,
 * it is bounded by its task or the wake limit, and it can be undone.
 * `start_session` subscribes on its own.
 */
@Injectable()
export class BotWatchToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly watches: BotSessionWatchResolver,
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly waits: BotSessionWaitResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.watchSession(), this.unwatchSession(), this.listWatches(), this.waitForSession()];
  }

  private watchSession(): BotToolDefinition {
    return defineBotTool({
      name: 'watch_session',
      scope: 'sessions:read',
      description: promptText('tools/watch.watch-session', {
        subscriptionWakeLimit: String(BOT_SUBSCRIPTION_WAKE_LIMIT),
        subscriptionsPerBot: String(BOT_SUBSCRIPTIONS_PER_BOT),
      }),
      input: z.object({
        session_id: z.uuid().describe(promptText('tools/watch.watch-session-session-id')),
        until: z
          .enum(['task', 'closed'])
          .optional()
          .describe(promptText('tools/watch.watch-session-until')),
        purpose: z
          .string()
          .min(1)
          .max(BOT_SUBSCRIPTION_PURPOSE_MAX)
          .optional()
          .describe(promptText('tools/watch.watch-session-purpose')),
        pattern: z
          .string()
          .min(1)
          .max(TERMINAL_WATCH_PATTERN_MAX)
          .optional()
          .describe(promptText('tools/watch.watch-session-pattern')),
        check_in_minutes: z
          .number()
          .int()
          .min(BOT_CHECK_IN_MINUTES.min)
          .max(BOT_CHECK_IN_MINUTES.max)
          .optional()
          .describe(promptText('tools/watch.watch-session-check-in-minutes')),
      }),
      run: async (input, context) => {
        const { subscription, session } = await this.watches.watch(context, input.session_id, {
          until: input.until ?? 'task',
          purpose: input.purpose ?? null,
          from: 'now',
        });
        const live = liveTaskOf(subscription.watchedTurn, session.latestTurn);
        if (live !== null) {
          await this.watches.stageLooks(
            subscription,
            session.id,
            live,
            input.check_in_minutes ?? null,
          );
        }
        const answer = [
          describeWatchStarted(subscription, session),
          checkInAnswer(live !== null, input.check_in_minutes ?? null),
        ]
          .filter(Boolean)
          .join(' ');
        if (!input.pattern) return answer;
        const hints = await this.watches.watchTerminal(context, subscription, input.pattern);
        return `${answer} ${describePatternWatch(input.pattern, hints)}`;
      },
    });
  }

  private unwatchSession(): BotToolDefinition {
    return defineBotTool({
      name: 'unwatch_session',
      scope: 'sessions:read',
      description: promptText('tools/watch.unwatch-session'),
      input: z.object({
        session_id: z.uuid().describe(promptText('tools/watch.unwatch-session-session-id')),
      }),
      run: async (input, context) => {
        // Its terminal watch goes too, if it had one: nobody else is woken by it.
        const followed = (
          await this.subscriptions.findForBot(
            context.organizationId,
            context.botId,
            BOT_SUBSCRIPTIONS_PER_BOT,
          )
        ).find((subscription) => subscription.resourceId === input.session_id);
        if (followed) await this.watches.release(followed);
        const removed = await this.subscriptions.unsubscribe(
          context.organizationId,
          context.botId,
          input.session_id,
        );
        return removed
          ? promptText('tools/watch.unwatch-session-longer-follow-session', {
              sessionId: input.session_id,
            })
          : promptText('tools/watch.unwatch-session-were-following-session', {
              sessionId: input.session_id,
            });
      },
    });
  }

  private listWatches(): BotToolDefinition {
    return defineBotTool({
      name: 'list_watches',
      scope: 'sessions:read',
      readOnly: true,
      description: promptText('tools/watch.list-watches'),
      input: z.object({}),
      run: async (_input, context) => {
        const watched = await this.subscriptions.findForBot(
          context.organizationId,
          context.botId,
          BOT_SUBSCRIPTIONS_PER_BOT,
        );
        if (!watched.length) return promptText('tools/watch.list-watches-follow-sessions-pull');
        return watched
          .map((subscription) => describeWatch(subscription, context.timeZone))
          .join('\n');
      },
    });
  }

  private waitForSession(): BotToolDefinition {
    return defineBotTool({
      name: 'wait_for_session',
      scope: 'sessions:read',
      description: promptText('tools/watch.wait-for-session', {
        sessionWaitMaxSeconds: String(BOT_SESSION_WAIT_MAX_SECONDS),
        sessionWaitsPerTurn: String(BOT_SESSION_WAITS_PER_TURN),
      }),
      input: z.object({
        session_id: z.uuid().describe(promptText('tools/watch.wait-for-session-session-id')),
        seconds: z
          .number()
          .int()
          .min(5)
          .max(BOT_SESSION_WAIT_MAX_SECONDS)
          .default(60)
          .describe('How long to wait at most.'),
      }),
      run: async (input, context, signal) => {
        if (!context.budget.take('wait_for_session', BOT_SESSION_WAITS_PER_TURN)) {
          throw new BotToolRefusal(
            promptText('tools/watch.wait-for-session-have-waited-times', {
              sessionWaitsPerTurn: String(BOT_SESSION_WAITS_PER_TURN),
            }),
          );
        }
        return this.waits.wait(context, input.session_id, input.seconds, signal);
      },
    });
  }
}
