import { Inject, Injectable } from '@nestjs/common';
import { TERMINAL_WATCH_PATTERN_MAX } from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import { BotSubscriptionMapper } from '../bot-subscription.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../database/bot-subscription.repository.port';
import {
  BOT_SESSION_WAIT_MAX_SECONDS,
  BOT_SESSION_WAITS_PER_TURN,
} from '../domain/bot-session-wait.policy';
import {
  BOT_SUBSCRIPTION_PURPOSE_MAX,
  BOT_SUBSCRIPTION_WAKE_LIMIT,
  BOT_SUBSCRIPTIONS_PER_BOT,
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
 * Following sessions (`27-bot-subscriptions.md` §3): watch one, stop
 * watching it, list what is watched, or wait on one inside the turn, a
 * bounded `wait_for_session`. None asks: a watch only wakes the bot
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
    private readonly waits: BotSessionWaitResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.watchSession(), this.unwatchSession(), this.listWatches(), this.waitForSession()];
  }

  private watchSession(): BotToolDefinition {
    return defineBotTool({
      name: 'watch_session',
      scope: 'sessions:read',
      description: `Subscribes you to a session, so you are woken with a turn of your own when its task needs input, finishes, fails or is stopped: no need to check on it or to be asked. Sessions you start with start_session are watched already. until "task" (the default) follows the task running now, or the next one if none is; "closed" follows every task until the session is closed. With pattern (a regular expression, matched line by line), you are also woken when its terminal prints a new line matching it, such as "FAIL|Error" or "Tests: \\d+ passed": you are told it matched and how often, never the line, so read the session to see why. At most ${BOT_SUBSCRIPTION_WAKE_LIMIT} wakes per watch, matches included, and ${BOT_SUBSCRIPTIONS_PER_BOT} watched sessions.`,
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
        pattern: z
          .string()
          .min(1)
          .max(TERMINAL_WATCH_PATTERN_MAX)
          .optional()
          .describe(
            'A regular expression (RE2: no lookaround or backreferences) to be woken by when a new line of the terminal matches it.',
          ),
      }),
      run: async (input, context) => {
        const { subscription, session } = await this.watches.watch(context, input.session_id, {
          until: input.until ?? 'task',
          purpose: input.purpose ?? null,
          from: 'now',
        });
        const answer = this.mapper.toWatchAnswer(subscription, session);
        if (!input.pattern) return answer;
        const hints = await this.watches.watchTerminal(context, subscription, input.pattern);
        return `${answer} ${this.mapper.toPatternAnswer(input.pattern, hints)}`;
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

  private waitForSession(): BotToolDefinition {
    return defineBotTool({
      name: 'wait_for_session',
      scope: 'sessions:read',
      description: `Waits inside this turn, up to seconds (at most ${BOT_SESSION_WAIT_MAX_SECONDS}), until a session's current task needs input, finishes, fails or is stopped, or the session is closed; answers at once if it already has. Use it for a short task you want to report on in this reply; for anything longer, watch_session wakes you when it ends. At most ${BOT_SESSION_WAITS_PER_TURN} waits a turn.`,
      input: z.object({
        session_id: z.uuid().describe('The session to wait on (from list_sessions).'),
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
            `You have waited ${BOT_SESSION_WAITS_PER_TURN} times this turn. Watch the session with watch_session and end your turn; it wakes you when the task ends.`,
          );
        }
        return this.waits.wait(context, input.session_id, input.seconds, signal);
      },
    });
  }
}
