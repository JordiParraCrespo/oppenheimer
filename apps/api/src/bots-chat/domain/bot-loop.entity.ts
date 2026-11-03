import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_LOOP_INTERVAL_MAX_MINUTES,
  BOT_LOOP_INTERVAL_MIN_MINUTES,
  BOT_LOOP_LIFETIME_MS,
  BOT_LOOP_PROMPT_MAX,
  type Scope,
} from '@oppenheimer/shared';

export interface BotLoopProps {
  organizationId: string;
  botId: string;
  /** The bot's turn that set it: its first run. */
  originTurnId: string;
  /** What each run does. */
  prompt: string;
  /** Minutes between runs; null when the bot says when it runs next. */
  intervalMinutes: number | null;
  /** The runs queued after the first. */
  runs: number;
  /** When the next run is due; null while a self-paced loop waits for its run to say. */
  nextRunAt: Date | null;
  expiresAt: Date;
  /** The setting turn's credential scopes; null for a browser session. */
  credentialScopes: readonly Scope[] | null;
  timeZone: string | null;
}

/**
 * A loop (`25-bots.md` §4.1, `/loop`): one per bot, a prompt run now and
 * again every interval, or when the bot says, until it is stopped, the bot
 * ends it or it expires. A run is claimed on the count and the time it was
 * loaded at, so two dispatches of one run queue one, and a run the bot moved
 * leaves the old dispatch with nothing to do.
 */
export class BotLoopEntity extends AggregateRoot<BotLoopProps> {
  private loadedRuns: number;
  private loadedNextRunAt: Date | null;

  constructor(create: CreateEntityProps<BotLoopProps>) {
    super(create);
    this.loadedRuns = create.props.runs;
    this.loadedNextRunAt = create.props.nextRunAt;
  }

  static create(create: CreateEntityProps<BotLoopProps>): BotLoopEntity {
    return new BotLoopEntity(create);
  }

  /** A loop set now: its first run is the setting turn; a fixed one's next is an interval away. */
  static set(
    props: Omit<BotLoopProps, 'runs' | 'nextRunAt' | 'expiresAt'>,
    now: Date,
  ): BotLoopEntity {
    const loop = new BotLoopEntity({
      id: randomUUID(),
      props: {
        ...props,
        prompt: props.prompt.trim(),
        runs: 0,
        nextRunAt:
          props.intervalMinutes === null
            ? null
            : new Date(now.getTime() + props.intervalMinutes * 60_000),
        expiresAt: new Date(now.getTime() + BOT_LOOP_LIFETIME_MS),
      },
    });
    loop.validate();
    return loop;
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
  get prompt(): string {
    return this.props.prompt;
  }
  get intervalMinutes(): number | null {
    return this.props.intervalMinutes;
  }
  get selfPaced(): boolean {
    return this.props.intervalMinutes === null;
  }
  get runs(): number {
    return this.props.runs;
  }
  get nextRunAt(): Date | null {
    return this.props.nextRunAt;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }
  get credentialScopes(): readonly Scope[] | null {
    return this.props.credentialScopes;
  }
  get timeZone(): string | null {
    return this.props.timeZone;
  }
  /** The count a conditional write is checked against. */
  get runsAtLoad(): number {
    return this.loadedRuns;
  }
  /** The due time a conditional write is checked against. */
  get nextRunAtLoad(): Date | null {
    return this.loadedNextRunAt;
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  /** Counts the run queued now and sets when the next is due (null: the run will say). */
  ran(next: Date | null): number {
    this.props.runs += 1;
    this.props.nextRunAt = next;
    return this.props.runs;
  }

  /** Moves the next run, the count unchanged: a skip, or the bot saying when. */
  moveNext(next: Date): void {
    this.props.nextRunAt = next;
  }

  /** After a winning write, what was stored is what later writes are checked against. */
  markPersisted(): void {
    this.loadedRuns = this.props.runs;
    this.loadedNextRunAt = this.props.nextRunAt;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId || !props.originTurnId) {
      throw new ArgumentNotProvidedException('A loop belongs to a bot and the turn that set it');
    }
    if (!props.prompt || props.prompt.length > BOT_LOOP_PROMPT_MAX) {
      throw new ArgumentInvalidException(
        `A loop's prompt is 1 to ${BOT_LOOP_PROMPT_MAX} characters`,
      );
    }
    if (
      props.intervalMinutes !== null &&
      (!Number.isInteger(props.intervalMinutes) ||
        props.intervalMinutes < BOT_LOOP_INTERVAL_MIN_MINUTES ||
        props.intervalMinutes > BOT_LOOP_INTERVAL_MAX_MINUTES)
    ) {
      throw new ArgumentInvalidException(
        `A loop runs every ${BOT_LOOP_INTERVAL_MIN_MINUTES} to ${BOT_LOOP_INTERVAL_MAX_MINUTES} minutes`,
      );
    }
    if (!Number.isInteger(props.runs) || props.runs < 0) {
      throw new ArgumentInvalidException('A loop counts its runs from 0');
    }
  }
}
