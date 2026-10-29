import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import type { BotSessionWakeState, Scope } from '@oppenheimer/shared';
import {
  BOT_SUBSCRIPTION_PURPOSE_MAX,
  type BotSubscriptionKind,
  type BotSubscriptionUntil,
  type WakeSubject,
} from './bot-subscription.policy';

export interface BotSubscriptionProps {
  organizationId: string;
  botId: string;
  resourceKind: BotSubscriptionKind;
  resourceId: string;
  /** The bot's turn that subscribed; null once its chat is cleared. */
  originTurnId: string | null;
  /** Why the bot follows it, in its words. */
  purpose: string | null;
  until: BotSubscriptionUntil;
  /** The task followed, for `until: 'task'`. */
  watchedTurn: number | null;
  /** The subscribing turn's credential scopes; null for a browser session. */
  credentialScopes: readonly Scope[] | null;
  timeZone: string | null;
  lastTurn: number | null;
  lastState: BotSessionWakeState | null;
  wakes: number;
  /**
   * The pattern the bot watches the session's terminal for, and the
   * sessions module's watch behind it; null when it follows the task alone.
   */
  terminalWatch: { id: string; pattern: string } | null;
  /** The newest count of matching lines a wake reported; 0 while it never matched. */
  matches: number;
  /** How many writes the row has had; 0 for one not stored yet. */
  version: number;
}

/**
 * A bot following work it delegated (`27-bot-subscriptions.md`): one bot,
 * one session, the reason and the turn behind it, and the wakes it caused.
 * Its writes are conditioned on the version it was loaded at, so two wakes
 * of one subscription never both record.
 */
export class BotSubscriptionEntity extends AggregateRoot<BotSubscriptionProps> {
  private loadedVersion: number;

  constructor(create: CreateEntityProps<BotSubscriptionProps>) {
    super(create);
    this.loadedVersion = create.props.version;
  }

  static create(create: CreateEntityProps<BotSubscriptionProps>): BotSubscriptionEntity {
    return new BotSubscriptionEntity(create);
  }

  /**
   * A bot starts following a session. `known` is the newest state of it the
   * bot already knows, so an event about that state, delivered late, wakes
   * nothing.
   */
  static subscribe(props: {
    organizationId: string;
    botId: string;
    sessionId: string;
    originTurnId: string | null;
    purpose: string | null;
    until: BotSubscriptionUntil;
    watchedTurn: number | null;
    credentialScopes: readonly Scope[] | null;
    timeZone: string | null;
    known: { lastTurn: number; lastState: BotSessionWakeState } | null;
  }): BotSubscriptionEntity {
    const subscription = new BotSubscriptionEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        botId: props.botId,
        resourceKind: 'session',
        resourceId: props.sessionId,
        originTurnId: props.originTurnId,
        purpose: props.purpose?.trim() || null,
        until: props.until,
        watchedTurn: props.until === 'task' ? props.watchedTurn : null,
        credentialScopes: props.credentialScopes,
        timeZone: props.timeZone,
        lastTurn: props.known?.lastTurn ?? null,
        lastState: props.known?.lastState ?? null,
        wakes: 0,
        terminalWatch: null,
        matches: 0,
        version: 0,
      },
    });
    subscription.validate();
    return subscription;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get resourceKind(): BotSubscriptionKind {
    return this.props.resourceKind;
  }
  get resourceId(): string {
    return this.props.resourceId;
  }
  get originTurnId(): string | null {
    return this.props.originTurnId;
  }
  get purpose(): string | null {
    return this.props.purpose;
  }
  get until(): BotSubscriptionUntil {
    return this.props.until;
  }
  get watchedTurn(): number | null {
    return this.props.watchedTurn;
  }
  get credentialScopes(): readonly Scope[] | null {
    return this.props.credentialScopes;
  }
  get timeZone(): string | null {
    return this.props.timeZone;
  }
  get lastTurn(): number | null {
    return this.props.lastTurn;
  }
  get lastState(): BotSessionWakeState | null {
    return this.props.lastState;
  }
  get wakes(): number {
    return this.props.wakes;
  }
  get terminalWatch(): { id: string; pattern: string } | null {
    return this.props.terminalWatch;
  }
  get matches(): number {
    return this.props.matches;
  }
  /** The version its next write is conditioned on. */
  get versionAtLoad(): number {
    return this.loadedVersion;
  }

  /** What `wakeFor` reads of it. */
  get wakeSubject(): WakeSubject {
    const { until, watchedTurn, lastTurn, lastState, wakes } = this.props;
    return { id: this.id, until, watchedTurn, lastTurn, lastState, wakes };
  }

  /** A wake was queued for this task in this state. */
  recordWake(turn: number, state: BotSessionWakeState): void {
    this.props.lastTurn = turn;
    this.props.lastState = state;
    this.props.wakes += 1;
    this.validate();
  }

  /**
   * A wake was queued for a match of its pattern: `count` is the runner's
   * cumulative count, so a late or repeated report never moves it back.
   */
  recordMatch(count: number): void {
    this.props.matches = Math.max(this.props.matches, count);
    this.props.wakes += 1;
    this.validate();
  }

  /** The write that stored this instance landed: its next one is conditioned on that. */
  markPersisted(): void {
    this.loadedVersion += 1;
    this.props.version = this.loadedVersion;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId || !props.resourceId) {
      throw new ArgumentNotProvidedException('A subscription is a bot following a resource');
    }
    if ((props.until === 'task') !== (props.watchedTurn !== null)) {
      throw new ArgumentInvalidException('Only a subscription to one task names the task');
    }
    if (props.watchedTurn !== null && props.watchedTurn < 1) {
      throw new ArgumentInvalidException('A task is numbered from 1');
    }
    if (
      props.purpose !== null &&
      (!props.purpose.trim() || props.purpose.length > BOT_SUBSCRIPTION_PURPOSE_MAX)
    ) {
      throw new ArgumentInvalidException(
        `A purpose holds 1 to ${BOT_SUBSCRIPTION_PURPOSE_MAX} characters`,
      );
    }
    if ((props.lastTurn === null) !== (props.lastState === null)) {
      throw new ArgumentInvalidException('The last wake names its task and its state');
    }
    if (props.wakes < 0) throw new ArgumentInvalidException('Wakes are never negative');
    if (props.matches < 0) throw new ArgumentInvalidException('Matches are never negative');
  }
}
