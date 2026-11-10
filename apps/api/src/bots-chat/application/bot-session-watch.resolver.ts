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
  type BotWatchFrom,
  checkDelayMs,
  checkTurnOf,
  followOptionsOf,
  requestedCheckNumber,
  type SessionWatchOptions,
} from '../domain/bot-subscription.policy';
import type { BotStallChecksPort } from '../infrastructure/bot-stall-checks.port';
import { type BotToolCallContext, BotToolRefusal } from './bot-tool.factory';

/** What `start_session`, `send_to_session` and `answer_session` answer once the task they set going is followed. */
const HANDED_OFF =
  'You are subscribed to it and will be woken when the task needs input or ends, if it has not got going in a few minutes, and every few minutes while it runs so you can look at how it is going: end your turn now, and report when you are.';

/** What a tool that set a task going answers when the bot said `watch: false`. */
const NOT_FOLLOWED = 'You are not watching it; read how it goes with get_session or read_session.';

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
   * counts as known, so only what follows wakes it), unless the bot said
   * `watch: false`. What it follows is `followOptionsOf`'s, and its looks
   * go to `checkTurnOf`'s task. The
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
    watch = true,
  ): Promise<string> {
    if (!watch) return NOT_FOLLOWED;
    try {
      const { subscription, session } = await this.store(context, sessionId, (current) =>
        followOptionsOf(current, from),
      );
      await this.commands.execute(
        new WakeSubscribedBotCommand({ subscriptionId: subscription.id }),
      );
      const turn = checkTurnOf(subscription.watchedTurn, from, session.latestTurn);
      if (turn !== null) await this.stageLooks(subscription, sessionId, turn, null);
      return HANDED_OFF;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `It could not be watched (${reason}); read it later with get_session.`;
    }
  }

  /**
   * Owes a followed task its looks: the first of the regular checks (the
   * stall check, then the looks at its progress), `checkDelayMs(1)` from
   * now, and, when the bot asked for one (`watch_session`'s
   * `check_in_minutes`), one more that many minutes from now, numbered by
   * the minute it is due (`requestedCheckNumber`) so no regular check
   * already delivered swallows it. The watch is stored either way, and its
   * wakes still come, so a check that cannot be staged is logged, not said.
   */
  async stageLooks(
    subscription: BotSubscriptionEntity,
    sessionId: string,
    turn: number,
    checkInMinutes: number | null,
  ): Promise<void> {
    const now = Date.now();
    await this.stageCheck(subscription, sessionId, turn, 1, new Date(now + checkDelayMs(1)));
    if (checkInMinutes === null) return;
    const at = new Date(now + checkInMinutes * 60_000);
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

  /** Follows a session as the bot asked (`watch_session`): what it says replaces what it followed. */
  watch(
    context: BotToolCallContext,
    sessionId: string,
    options: SessionWatchOptions,
  ): Promise<SessionWatch> {
    return this.store(context, sessionId, () => options);
  }

  /** Stores the watch `choose` decides from the bot's current one of the session, if any. */
  private async store(
    context: BotToolCallContext,
    sessionId: string,
    choose: (current: BotSubscriptionEntity | null) => SessionWatchOptions,
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
    const subscription = await this.subscriptions.subscribe(
      BotSubscriptionEntity.subscribe(
        this.mapper.toSubscribeProps(context, session, choose(current ?? null)),
      ),
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
