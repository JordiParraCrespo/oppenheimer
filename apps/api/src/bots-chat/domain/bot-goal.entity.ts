import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_GOAL_IDLE_TURNS,
  BOT_GOAL_OBJECTIVE_MAX,
  BOT_GOAL_TOKEN_BUDGET_MIN,
  type BotGoalPauseReason,
  type Scope,
} from '@oppenheimer/shared';
import type { BotRateLimit } from './bot-rate-limit.policy';

/** What every goal continuation's key begins with. */
export const GOAL_KEY_PREFIX = 'goal:';

/** What every continuation key of a goal begins with: one queued blocks the next. */
export function goalKeyPrefix(goalId: string): string {
  return `${GOAL_KEY_PREFIX}${goalId}:`;
}

export interface BotGoalProps {
  organizationId: string;
  botId: string;
  /** The bot's turn that set it. */
  originTurnId: string;
  /** What the bot keeps working toward, in its words. */
  objective: string;
  /** The continuations it may queue; null for none (every goal since 2026-11-09). */
  limit: number | null;
  /** The continuations queued so far. */
  continuations: number;
  /** The tokens its turns spent, input and output. */
  tokensUsed: number;
  /** The tokens it may spend before it pauses as `budget`; null for no budget. */
  tokenBudget: number | null;
  /** Its turns in a row that called no tool (`BOT_GOAL_IDLE_TURNS`). */
  idleTurns: number;
  /**
   * The bot said the goal is met (`end_goal`), in its words: the reviewer
   * checks the claim when the turn ends. Null when it has not said so.
   */
  claim: string | null;
  /** Why and since when it is paused; null while it runs. */
  paused: { reason: BotGoalPauseReason; note: string | null; at: Date } | null;
  /** The setting turn's credential scopes; null for a browser session. */
  credentialScopes: readonly Scope[] | null;
  timeZone: string | null;
  /**
   * The system whose rate limit a turn of the goal ended on, and until when:
   * the goal's next decision is held until then (`bot-rate-limit.policy.ts`).
   * Null when nothing holds it. `hold` sets it, `advance` clears it.
   */
  waiting?: BotRateLimit | null;
}

/**
 * A goal a bot keeps working toward (`25-bots.md` §4.1): one per bot, kept
 * until the reviewer finds the bot's claim that it is met holds, or the owner
 * stops it. Nothing else ends it: what would have (a failed turn, a stopped
 * one, turns that do nothing, its budget, the bot blocked) pauses it in
 * place, and the owner resumes it. A continuation is claimed on the count it
 * was loaded at, so two turns ending at once queue one.
 */
export class BotGoalEntity extends AggregateRoot<BotGoalProps> {
  private loadedContinuations: number;

  constructor(create: CreateEntityProps<BotGoalProps>) {
    super(create);
    this.loadedContinuations = create.props.continuations;
  }

  static create(create: CreateEntityProps<BotGoalProps>): BotGoalEntity {
    return new BotGoalEntity(create);
  }

  static set(
    props: Omit<
      BotGoalProps,
      'continuations' | 'waiting' | 'limit' | 'tokensUsed' | 'idleTurns' | 'claim' | 'paused'
    >,
  ): BotGoalEntity {
    const goal = new BotGoalEntity({
      id: randomUUID(),
      props: {
        ...props,
        objective: props.objective.trim(),
        limit: null,
        continuations: 0,
        tokensUsed: 0,
        idleTurns: 0,
        claim: null,
        paused: null,
        waiting: null,
      },
    });
    goal.validate();
    return goal;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get originTurnId(): string {
    return this.props.originTurnId;
  }
  get objective(): string {
    return this.props.objective;
  }
  get limit(): number | null {
    return this.props.limit;
  }
  get tokensUsed(): number {
    return this.props.tokensUsed;
  }
  get tokenBudget(): number | null {
    return this.props.tokenBudget;
  }
  get idleTurns(): number {
    return this.props.idleTurns;
  }
  get claim(): string | null {
    return this.props.claim;
  }
  get paused(): BotGoalProps['paused'] {
    return this.props.paused;
  }
  get continuations(): number {
    return this.props.continuations;
  }
  get credentialScopes(): readonly Scope[] | null {
    return this.props.credentialScopes;
  }
  get timeZone(): string | null {
    return this.props.timeZone;
  }
  /** The rate limit its next decision waits out; null when nothing holds it. */
  get waiting(): BotRateLimit | null {
    return this.props.waiting ?? null;
  }
  /** The count a conditional write is checked against. */
  get continuationsAtLoad(): number {
    return this.loadedContinuations;
  }
  /** Whether a goal with a limit (one set before 2026-11-09) has queued every continuation it may. */
  get exhausted(): boolean {
    return this.props.limit !== null && this.props.continuations >= this.props.limit;
  }

  /** Whether its token budget is spent. */
  get overBudget(): boolean {
    return this.props.tokenBudget !== null && this.props.tokensUsed >= this.props.tokenBudget;
  }

  /** Whether its turns have stopped calling tools for long enough to pause it. */
  get idle(): boolean {
    return this.props.idleTurns >= BOT_GOAL_IDLE_TURNS;
  }

  /**
   * Counts one of its turns that ended: what it spent, and whether it called
   * a tool. A turn that did is progress; `BOT_GOAL_IDLE_TURNS` in a row that
   * did not make the goal `idle`.
   */
  account(turn: { tokens: number; calledTools: boolean }): void {
    this.props.tokensUsed += Math.max(0, Math.round(turn.tokens));
    this.props.idleTurns = turn.calledTools ? 0 : this.props.idleTurns + 1;
  }

  /** The bot says the goal is met: the reviewer checks it when the turn ends. */
  claimMet(words: string): void {
    this.props.claim = words.trim().slice(0, 1_000) || 'The bot said the goal is met.';
  }

  /** The reviewer found the claim does not hold yet: the goal goes on, the claim withdrawn. */
  rejectClaim(): void {
    this.props.claim = null;
  }

  /** Pauses it in place; already paused keeps the first reason. */
  pause(reason: BotGoalPauseReason, note: string | null, now: Date): void {
    if (this.props.paused) return;
    this.props.paused = { reason, note: note?.trim().slice(0, 500) || null, at: now };
    this.props.waiting = null;
  }

  /** The owner resumes it: it runs again with a fresh count of idle turns. */
  resume(): void {
    this.props.paused = null;
    this.props.idleTurns = 0;
    this.props.claim = null;
  }

  /**
   * Whether `turn` is one of this goal's own: the turn that set it or one of
   * its continuations. A goal set in place of another is not held by the old
   * goal's turns.
   */
  isHeldBy(turn: { id: string; sourceKey: string | null }): boolean {
    return (
      turn.id === this.props.originTurnId ||
      (turn.sourceKey?.startsWith(goalKeyPrefix(this.id)) ?? false)
    );
  }

  /** Its next decision waits out `limit`: the chat says so until it goes on. */
  hold(limit: BotRateLimit): void {
    this.props.waiting = { system: limit.system.slice(0, 64), resetAt: limit.resetAt };
  }

  /** Counts the next continuation and answers its number; a wait it was holding for is over. */
  advance(): number {
    if (this.exhausted) {
      throw new ArgumentInvalidException('A goal past its limit queues no more continuations');
    }
    if (this.props.paused) {
      throw new ArgumentInvalidException(
        'A paused goal queues no continuation until it is resumed',
      );
    }
    this.props.continuations += 1;
    this.props.waiting = null;
    return this.props.continuations;
  }

  /** After a winning write, the count stored is the one later writes are checked against. */
  markPersisted(): void {
    this.loadedContinuations = this.props.continuations;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId || !props.originTurnId) {
      throw new ArgumentNotProvidedException('A goal belongs to a bot and the turn that set it');
    }
    if (!props.objective || props.objective.length > BOT_GOAL_OBJECTIVE_MAX) {
      throw new ArgumentInvalidException(
        `A goal says what it is in 1 to ${BOT_GOAL_OBJECTIVE_MAX} characters`,
      );
    }
    if (props.limit !== null && (!Number.isInteger(props.limit) || props.limit < 1)) {
      throw new ArgumentInvalidException('A goal with a limit queues at least 1 continuation');
    }
    if (
      props.tokenBudget !== null &&
      (!Number.isInteger(props.tokenBudget) || props.tokenBudget < BOT_GOAL_TOKEN_BUDGET_MIN)
    ) {
      throw new ArgumentInvalidException(
        `A goal's token budget is at least ${BOT_GOAL_TOKEN_BUDGET_MIN} tokens`,
      );
    }
    if (!Number.isInteger(props.continuations) || props.continuations < 0) {
      throw new ArgumentInvalidException('A goal counts its continuations from 0');
    }
  }
}
