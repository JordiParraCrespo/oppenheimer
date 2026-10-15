import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { BOT_TURN_STATUSES, type BotProvider, type BotTurnStatus } from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';

export interface BotTurnProps {
  organizationId: string;
  botId: string;
  /** Who sent the message; null once that account is gone. */
  requestedByUserId: string | null;
  status: BotTurnStatus;
  /** The engine and model it runs on, fixed when it is sent, so a later pick never changes it. */
  provider: BotProvider;
  model: string;
  effort: SessionEffort | null;
  /** Why it failed, in words a person can act on; never a key. */
  error: string | null;
  inputTokens: number;
  outputTokens: number;
  cancelRequestedAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
}

/** The statuses a turn ends in. */
export const ENDED_TURN_STATUSES: readonly BotTurnStatus[] = ['completed', 'cancelled', 'failed'];

/**
 * One message of yours and the bot's answer to it (`25-bots.md` §2): queued
 * until the bot's turn before it ends, running on one worker, then ended.
 * The status a turn was loaded in is what its next write is conditioned on,
 * so two workers, or a worker and Stop, never both move it.
 */
export class BotTurnEntity extends AggregateRoot<BotTurnProps> {
  private loadedStatus: BotTurnStatus;

  constructor(create: CreateEntityProps<BotTurnProps>) {
    super(create);
    this.loadedStatus = create.props.status;
  }

  static create(create: CreateEntityProps<BotTurnProps>): BotTurnEntity {
    return new BotTurnEntity(create);
  }

  static queue(props: {
    organizationId: string;
    botId: string;
    requestedByUserId: string;
    provider: BotProvider;
    model: string;
    effort: SessionEffort | null;
  }): BotTurnEntity {
    const turn = new BotTurnEntity({
      id: randomUUID(),
      props: {
        ...props,
        status: 'queued',
        error: null,
        inputTokens: 0,
        outputTokens: 0,
        cancelRequestedAt: null,
        startedAt: null,
        endedAt: null,
      },
    });
    turn.validate();
    return turn;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get requestedByUserId(): string | null {
    return this.props.requestedByUserId;
  }
  get status(): BotTurnStatus {
    return this.props.status;
  }
  get statusAtLoad(): BotTurnStatus {
    return this.loadedStatus;
  }
  get provider(): BotProvider {
    return this.props.provider;
  }
  get model(): string {
    return this.props.model;
  }
  get effort(): SessionEffort | null {
    return this.props.effort;
  }
  get error(): string | null {
    return this.props.error;
  }
  get inputTokens(): number {
    return this.props.inputTokens;
  }
  get outputTokens(): number {
    return this.props.outputTokens;
  }
  get cancelRequestedAt(): Date | null {
    return this.props.cancelRequestedAt;
  }
  get startedAt(): Date | null {
    return this.props.startedAt;
  }
  get endedAt(): Date | null {
    return this.props.endedAt;
  }
  get ended(): boolean {
    return ENDED_TURN_STATUSES.includes(this.props.status);
  }

  /** A worker takes it. Only a queued turn starts. */
  start(now: Date): void {
    if (this.props.status !== 'queued') {
      throw new ArgumentInvalidException(`A ${this.props.status} turn cannot start`);
    }
    this.props.status = 'running';
    this.props.startedAt = now;
  }

  /** How it ended. Only a turn that has not ended ends. */
  end(
    status: 'completed' | 'cancelled' | 'failed',
    now: Date,
    outcome: { error?: string | null; inputTokens?: number; outputTokens?: number } = {},
  ): void {
    if (this.ended) throw new ArgumentInvalidException(`The turn already ${this.props.status}`);
    this.props.status = status;
    this.props.endedAt = now;
    this.props.error = status === 'failed' ? (outcome.error ?? 'The turn failed') : null;
    this.props.inputTokens = outcome.inputTokens ?? this.props.inputTokens;
    this.props.outputTokens = outcome.outputTokens ?? this.props.outputTokens;
  }

  /** The write that stored this instance landed: its next one is conditioned on what it holds now. */
  markPersisted(): void {
    this.loadedStatus = this.props.status;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId) {
      throw new ArgumentNotProvidedException('A turn belongs to a bot');
    }
    if (!BOT_TURN_STATUSES.includes(props.status)) {
      throw new ArgumentInvalidException(`${props.status} is not a turn status`);
    }
    if (!props.model) throw new ArgumentNotProvidedException('A turn runs on a model');
  }
}
