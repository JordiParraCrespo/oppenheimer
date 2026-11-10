import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RequestContextService } from '@oppenheimer/backend-ddd';
import { UnwatchSessionTerminalCommand } from '../../sessions/commands/unwatch-session-terminal/unwatch-session-terminal.command';
import {
  WatchSessionTerminalCommand,
  type WatchSessionTerminalResult,
} from '../../sessions/commands/watch-session-terminal/watch-session-terminal.command';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import { BotSubscriptionMapper } from '../bot-subscription.mapper';
import { BOT_STALL_CHECKS, BOT_SUBSCRIPTION_REPOSITORY } from '../bots-chat.di-tokens';
import { WakeSubscribedBotCommand } from '../commands/wake-subscribed-bot/wake-subscribed-bot.command';
import type { BotSubscriptionRepositoryPort } from '../database/bot-subscription.repository.port';
import { BotSubscriptionEntity } from '../domain/bot-subscription.entity';
import {
  BOT_SUBSCRIPTIONS_PER_BOT,
  type BotSubscriptionUntil,
  type BotWatchFrom,
  checkDelayMs,
  requestedCheckNumber,
} from '../domain/bot-subscription.policy';
import type { BotStallChecksPort } from '../infrastructure/bot-stall-checks.port';
import { type BotToolCallContext, BotToolRefusal } from './bot-tool.factory';

/** What `start_session`, `send_to_session` and `answer_session` answer once the task they set going is followed. */
const HANDED_OFF =
  'You are subscribed to it and will be woken when the task needs input or ends, if it has not got going in a few minutes, and every few minutes while it runs so you can look at how it is going: end your turn now, and report when you are.';

/** What a watch came to: the subscription as stored, and the session as it stood. */
export interface SessionWatch {
  subscription: BotSubscriptionEntity;
  session: WorkSessionEntity;
}

/**
 * A bot starts following a session (`27-bot-subscriptions.md` §3), from
 * `start_session` or `watch_session`: the session read as the owner, so a
 * bot follows only what its owner may read, and the subscription stored
 * with the turn that made it, its scopes and its zone. A task the bot hands
 * off also gets its silent stall check (§4.1).
 */
@Injectable()
export class BotSessionWatchResolver {
  private readonly logger = new Logger(BotSessionWatchResolver.name);

  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    @Inject(BOT_STALL_CHECKS) private readonly stallChecks: BotStallChecksPort,
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
    private readonly mapper: BotSubscriptionMapper,
  ) {}

  /**
   * Follows the task a bot just set going, for the answer of the tool that
   * did it: a session it started, from its first task (`start_session`), the
   * task its follow-up prompt opened, by number (`send_to_session`), or the
   * live task it unblocked (`answer_session`, `now`: the input it answered
   * counts as known, so only what follows wakes it). The
   * task may already have ended or blocked by the time the watch is stored
   * (a launch that failed at once), and its event then found nobody, so the
   * wake is asked for once now: it reads the session and wakes the bot if
   * there is news, and does nothing otherwise. The work was set going
   * whatever happens here, so a watch that cannot be stored is said, never
   * thrown.
   */
  async follow(
    context: BotToolCallContext,
    sessionId: string,
    from: BotWatchFrom,
  ): Promise<string> {
    try {
      const { subscription, session } = await this.watch(
        context,
        sessionId,
        { until: 'task', purpose: null, from },
        { narrow: false },
      );
      await this.commands.execute(
        new WakeSubscribedBotCommand({ subscriptionId: subscription.id }),
      );
      // A watch kept until the session closes names no task: the one set going is checked.
      const turn =
        subscription.watchedTurn ??
        (from === 'first_task' ? 1 : from === 'now' ? session.latestTurn?.seq : from.turn);
      if (turn !== undefined) await this.checkLater(subscription, sessionId, turn);
      return HANDED_OFF;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `It could not be watched (${reason}); read it later with get_session.`;
    }
  }

  /**
   * Owes the task its first check (the stall check, then the looks at its
   * progress), `checkDelayMs(1)` from now. The watch is stored either way,
   * and its wakes still come, so a check that cannot be staged is logged,
   * not said.
   */
  async checkLater(
    subscription: BotSubscriptionEntity,
    sessionId: string,
    turn: number,
  ): Promise<void> {
    await this.stageCheck(subscription, sessionId, turn, 1, new Date(Date.now() + checkDelayMs(1)));
  }

  /**
   * Owes the task one look the bot asked for itself (`watch_session`'s
   * `check_in_minutes`), at `at`, numbered by the minute it is due
   * (`requestedCheckNumber`): it shares no key with the regular checks, so
   * one of those already delivered never swallows it.
   */
  async checkInAt(
    subscription: BotSubscriptionEntity,
    sessionId: string,
    turn: number,
    at: Date,
  ): Promise<void> {
    await this.stageCheck(subscription, sessionId, turn, requestedCheckNumber(at), at);
  }

  private async stageCheck(
    subscription: BotSubscriptionEntity,
    sessionId: string,
    turn: number,
    check: number,
    at: Date,
  ): Promise<void> {
    try {
      await this.stallChecks.schedule(
        {
          subscriptionId: subscription.id,
          botId: subscription.botId,
          sessionId,
          turn,
          check,
        },
        at,
        RequestContextService.getCorrelationId() ?? null,
      );
    } catch (error) {
      this.logger.warn(
        { message: 'A stall check could not be staged', subscriptionId: subscription.id, turn },
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async watch(
    context: BotToolCallContext,
    sessionId: string,
    options: { until: BotSubscriptionUntil; purpose: string | null; from: BotWatchFrom },
    replace: { narrow: boolean } = { narrow: true },
  ): Promise<SessionWatch> {
    const session = await this.queries.execute<FindSessionQuery, WorkSessionEntity>(
      new FindSessionQuery({ scope: context.owner, sessionId }),
    );
    if (session.isResolved) {
      throw new BotToolRefusal(`Session ${sessionId} is closed: there is nothing left to follow.`);
    }
    const existing = await this.subscriptions.findForBot(
      context.organizationId,
      context.botId,
      BOT_SUBSCRIPTIONS_PER_BOT,
    );
    const current = existing.find((subscription) => subscription.resourceId === sessionId);
    if (!current && existing.length >= BOT_SUBSCRIPTIONS_PER_BOT) {
      throw new BotToolRefusal(
        `You already follow ${BOT_SUBSCRIPTIONS_PER_BOT} sessions and pull requests. Unwatch one you no longer need (list_watches shows them) first.`,
      );
    }
    // A tool that follows the task it set going widens a watch, never
    // narrows it: a session the bot follows until it closes, and why, stay so.
    const kept =
      current && !replace.narrow
        ? {
            ...options,
            until: current.until === 'closed' ? ('closed' as const) : options.until,
            purpose: options.purpose ?? current.purpose,
          }
        : options;
    const subscription = await this.subscriptions.subscribe(
      BotSubscriptionEntity.subscribe(this.mapper.toSubscribeProps(context, session, kept)),
    );
    return { subscription, session };
  }

  /**
   * Has the session's runner watch its terminal for `pattern` on behalf of
   * this subscription (`27-bot-subscriptions.md` §2): the sessions module
   * makes the watch and tells the host, and the subscription names it. A
   * pattern it replaces is removed. Answers what the host could not take
   * just now (`host_offline`, `not_supported`), which the tool says.
   */
  async watchTerminal(
    context: BotToolCallContext,
    subscription: BotSubscriptionEntity,
    pattern: string,
  ): Promise<string[]> {
    const sessionId = subscription.resourceId;
    if (!sessionId) throw new BotToolRefusal('Only a session has a terminal to watch.');
    const made = await this.commands.execute<
      WatchSessionTerminalCommand,
      WatchSessionTerminalResult
    >(
      new WatchSessionTerminalCommand({
        scope: context.owner,
        sessionId,
        pattern,
      }),
    );
    const previous = await this.subscriptions.attachTerminalWatch(subscription.id, {
      id: made.watchId,
      pattern,
    });
    if (previous) await this.releaseWatch(subscription.organizationId, sessionId, previous);
    return made.hints;
  }

  /**
   * Removes the terminal watch a subscription that ended named, if it named
   * one. Best effort: a watch left behind only stops matching anybody, and
   * goes with its session.
   */
  async release(subscription: BotSubscriptionEntity): Promise<void> {
    const watch = subscription.terminalWatch;
    const sessionId = subscription.resourceId;
    if (watch && sessionId)
      await this.releaseWatch(subscription.organizationId, sessionId, watch.id);
  }

  private async releaseWatch(organizationId: string, sessionId: string, watchId: string) {
    await this.commands
      .execute(new UnwatchSessionTerminalCommand({ organizationId, sessionId, watchId }))
      .catch(() => undefined);
  }
}
