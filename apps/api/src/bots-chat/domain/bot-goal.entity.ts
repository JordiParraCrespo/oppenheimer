import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_GOAL_CONTINUATIONS_MAX,
  BOT_GOAL_OBJECTIVE_MAX,
  type Scope,
} from '@oppenheimer/shared';

export interface BotGoalProps {
  organizationId: string;
  botId: string;
  /** The bot's turn that set it. */
  originTurnId: string;
  /** What the bot keeps working toward, in its words. */
  objective: string;
  /** The continuations it may queue. */
  limit: number;
  /** The continuations queued so far. */
  continuations: number;
  /** The setting turn's credential scopes; null for a browser session. */
  credentialScopes: readonly Scope[] | null;
  timeZone: string | null;
}

/**
 * A goal a bot set itself (`25-bots.md` §4.1): one per bot, kept until the
 * bot ends it, the owner stops it, a turn of it fails, or its continuations
 * run out. A continuation is claimed on the count it was loaded at, so two
 * turns ending at once queue one.
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

  static set(props: Omit<BotGoalProps, 'continuations'>): BotGoalEntity {
    const goal = new BotGoalEntity({
      id: randomUUID(),
      props: { ...props, objective: props.objective.trim(), continuations: 0 },
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
  get limit(): number {
    return this.props.limit;
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
  /** The count a conditional write is checked against. */
  get continuationsAtLoad(): number {
    return this.loadedContinuations;
  }
  /** Whether every continuation it may queue has been queued. */
  get exhausted(): boolean {
    return this.props.continuations >= this.props.limit;
  }

  /** Counts the next continuation and answers its number. */
  advance(): number {
    if (this.exhausted) {
      throw new ArgumentInvalidException('A goal past its limit queues no more continuations');
    }
    this.props.continuations += 1;
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
    if (
      !Number.isInteger(props.limit) ||
      props.limit < 1 ||
      props.limit > BOT_GOAL_CONTINUATIONS_MAX
    ) {
      throw new ArgumentInvalidException(
        `A goal queues 1 to ${BOT_GOAL_CONTINUATIONS_MAX} continuations`,
      );
    }
    if (!Number.isInteger(props.continuations) || props.continuations < 0) {
      throw new ArgumentInvalidException('A goal counts its continuations from 0');
    }
  }
}
