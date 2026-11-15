import type { BotPlanWatchScope } from '@oppenheimer/shared';
import type { BotSubscriptionEntity } from '../domain/bot-subscription.entity';

export interface BotSubscriptionRepositoryPort {
  /**
   * Stores a new subscription, or, when the bot already follows that
   * session, pull request, project or milestone, replaces what it follows
   * and why while keeping its id, its newest wake and its wake count.
   * Answers the subscription as stored.
   */
  subscribe(subscription: BotSubscriptionEntity): Promise<BotSubscriptionEntity>;

  /** By id alone: the wake's read, whose job carries nothing else it can trust. */
  findForWake(subscriptionId: string): Promise<BotSubscriptionEntity | null>;
  /** The ids of every bot subscription to a session, in the event's workspace. */
  findIdsForSession(organizationId: string, sessionId: string): Promise<string[]>;
  /** The ids of every bot subscription to a pull request, in the event's workspace. */
  findIdsForPullRequest(
    organizationId: string,
    githubRepoId: string,
    pullNumber: number,
  ): Promise<string[]>;
  /**
   * The ids of every bot subscription to these projects or these milestones,
   * in the change's workspace: those a logged change to a task wakes.
   */
  findIdsForPlan(
    organizationId: string,
    places: { projectIds: readonly string[]; milestoneIds: readonly string[] },
  ): Promise<string[]>;
  /** The subscriptions of one bot, oldest first, at most `limit`. */
  findForBot(
    organizationId: string,
    botId: string,
    limit: number,
  ): Promise<BotSubscriptionEntity[]>;
  /** How many sessions and pull requests the bot follows now. */
  countForBot(organizationId: string, botId: string): Promise<number>;

  /**
   * Records a wake, conditioned on the version the subscription was loaded
   * at. Whether this write won; a loser writes nothing.
   */
  recordWake(subscription: BotSubscriptionEntity): Promise<boolean>;
  /**
   * Takes one of a pull request subscription's wakes, unless `limit` are
   * taken: the count with this one in it, or null when none was left (or the
   * subscription is gone). One statement, so events delivered together take
   * one wake each, and never more than `limit` between them.
   */
  claimWake(subscriptionId: string, limit: number): Promise<number | null>;
  /** Counts a wake of a subscription with no wake limit (a project's or a milestone's). */
  countWake(subscriptionId: string): Promise<void>;
  /** Gives back a wake claimed for an event that queued no turn. */
  releaseWake(subscriptionId: string): Promise<void>;
  /**
   * Ends it, whatever was recorded since it was loaded: an end is final, so a
   * wake that recorded meanwhile (input needed, read before the task ended)
   * never keeps a finished subscription alive. Whether it was still there.
   */
  end(subscription: BotSubscriptionEntity): Promise<boolean>;
  /** The bot stops following the session. Whether it was following it. */
  unsubscribe(organizationId: string, botId: string, sessionId: string): Promise<boolean>;
  /** The bot stops following the pull request. Whether it was following it. */
  unsubscribePullRequest(
    organizationId: string,
    botId: string,
    pull: { githubRepoId: string; number: number },
  ): Promise<boolean>;
  /** The bot stops following the project or the milestone. Whether it was following it. */
  unsubscribePlan(
    organizationId: string,
    botId: string,
    scope: BotPlanWatchScope,
    resourceId: string,
  ): Promise<boolean>;
  /** Every bot stops following a milestone that is gone. How many did. */
  endForMilestone(organizationId: string, milestoneId: string): Promise<number>;
  /** The subscription that asked for this terminal watch, if one still does. */
  findForTerminalWatch(watchId: string): Promise<BotSubscriptionEntity | null>;
  /**
   * Names the terminal watch the subscription follows, resetting its match
   * count; answers the watch it named before, which the caller removes.
   */
  attachTerminalWatch(
    subscriptionId: string,
    watch: { id: string; pattern: string },
  ): Promise<string | null>;
}
