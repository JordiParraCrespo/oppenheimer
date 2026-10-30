import type { BotSubscriptionEntity } from '../domain/bot-subscription.entity';

export interface BotSubscriptionRepositoryPort {
  /**
   * Stores a new subscription, or, when the bot already follows that
   * session, replaces what it follows and why while keeping its id, its
   * newest wake and its wake count. Answers the subscription as stored.
   */
  subscribe(subscription: BotSubscriptionEntity): Promise<BotSubscriptionEntity>;

  /** By id alone: the wake's read, whose job carries nothing else it can trust. */
  findForWake(subscriptionId: string): Promise<BotSubscriptionEntity | null>;
  /** The ids of every bot subscription to a session, in the event's workspace. */
  findIdsForSession(organizationId: string, sessionId: string): Promise<string[]>;
  /** The subscriptions of one bot, oldest first, at most `limit`. */
  findForBot(
    organizationId: string,
    botId: string,
    limit: number,
  ): Promise<BotSubscriptionEntity[]>;
  /** How many sessions the bot follows now. */
  countForBot(organizationId: string, botId: string): Promise<number>;

  /**
   * Records a wake, conditioned on the version the subscription was loaded
   * at. Whether this write won; a loser writes nothing.
   */
  recordWake(subscription: BotSubscriptionEntity): Promise<boolean>;
  /**
   * Ends it, whatever was recorded since it was loaded: an end is final, so a
   * wake that recorded meanwhile (input needed, read before the task ended)
   * never keeps a finished subscription alive. Whether it was still there.
   */
  end(subscription: BotSubscriptionEntity): Promise<boolean>;
  /** The bot stops following the session. Whether it was following it. */
  unsubscribe(organizationId: string, botId: string, sessionId: string): Promise<boolean>;
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
