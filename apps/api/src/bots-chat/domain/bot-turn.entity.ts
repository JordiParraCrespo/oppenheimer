import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_TURN_LANES,
  BOT_TURN_STATUSES,
  type BotProvider,
  type BotTurnFailure,
  type BotTurnLane,
  type BotTurnOrigin,
  type BotTurnStatus,
  type Scope,
} from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';

export interface BotTurnProps {
  organizationId: string;
  botId: string;
  /** Who sent the message; null once that account is gone. */
  requestedByUserId: string | null;
  status: BotTurnStatus;
  /** Why it exists: a message of yours, an approval's decision, a routine's run, or a subscription's wake. */
  origin: BotTurnOrigin;
  /** What makes it happen once (`automation-run:<runId>`); null for a message. */
  sourceKey: string | null;
  /** The engine and model it runs on, fixed when it is sent, so a later pick never changes it. */
  provider: BotProvider;
  model: string;
  effort: SessionEffort | null;
  /** The sender's IANA time zone when they sent it; null means UTC. */
  timeZone: string | null;
  /**
   * The scopes of the credential the message was sent with (an API token, an
   * OAuth grant); null for a browser session. The turn's tools are those
   * these scopes cover, so a token reaches no further through a bot.
   */
  credentialScopes: readonly Scope[] | null;
  /** Which of the bot's waiting turns runs first (`BotQueueLanes`). */
  lane: BotTurnLane;
  /**
   * The first turn of the chain this one belongs to (`BotChainPolicy`): the
   * message of yours every bot-to-bot turn after it traces back to. Null on
   * that first turn, whose chain is its own id.
   */
  chainId: string | null;
  /** How many bots deep in its chain: 0 for a turn of yours. */
  chainDepth: number;
  /**
   * The bot whose tool call queued this turn, and that call's turn, as
   * Oppenheimer recorded them when it ran the call. Null on a turn of yours,
   * and once that bot is deleted or its chat cleared.
   */
  askedByBotId: string | null;
  askedByTurnId: string | null;
  /** Sent with `ask_bot`: when this turn ends, its answer is queued as a turn of the asker. */
  replyRequested: boolean;
  /** On the turn that delivers an answer, the turn it answers. */
  answersTurnId: string | null;
  /**
   * Sent as a steer: while it waits, the running turn of the same sender
   * takes its message at its next tool call (`BotSteerPolicy`); one it
   * never reached runs as the turn it is. Only a message of yours steers.
   */
  steer: boolean;
  /** Why it failed, in words a person can act on; never a key. */
  error: string | null;
  /** What kind of failure that was, so the chat can say whether a retry helps; null unless failed. */
  failure: BotTurnFailure | null;
  inputTokens: number;
  outputTokens: number;
  /** What the model's context held at the turn's last answer; null before one. */
  context: BotTurnContext | null;
  /** A subscription's usage windows as that answer said them; null on an API key. */
  planLimits: BotTurnPlanLimits | null;
  cancelRequestedAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
}

/** What the model's context held: the tokens, against its window when the engine knew it. */
export interface BotTurnContext {
  tokens: number;
  window: number | null;
}

/** One of a subscription's usage windows: the share used, 0–100, and when it resets. */
export interface BotTurnPlanWindow {
  usedPercent: number;
  resetsAt: Date | null;
}

/** A subscription's 5-hour and weekly windows, each null when the provider left it out. */
export interface BotTurnPlanLimits {
  fiveHour: BotTurnPlanWindow | null;
  sevenDay: BotTurnPlanWindow | null;
}

/** The longest failure a turn keeps (`bot_turn.error`); a longer one is cut to fit. */
export const BOT_TURN_ERROR_MAX = 1_000;

/**
 * How long one turn may run before it is stopped (`25-bots.md` §2). A chat
 * turn answers; work that takes longer belongs to a session on a host.
 */
export const BOT_TURN_TIME_LIMIT_MS = 4 * 60_000;

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
    timeZone?: string | null;
    credentialScopes?: readonly Scope[] | null;
    origin?: BotTurnOrigin;
    sourceKey?: string | null;
    lane?: BotTurnLane;
    chainId?: string | null;
    chainDepth?: number;
    askedByBotId?: string | null;
    askedByTurnId?: string | null;
    replyRequested?: boolean;
    answersTurnId?: string | null;
    steer?: boolean;
  }): BotTurnEntity {
    const turn = new BotTurnEntity({
      id: randomUUID(),
      props: {
        lane: 'owner',
        chainId: null,
        chainDepth: 0,
        askedByBotId: null,
        askedByTurnId: null,
        replyRequested: false,
        answersTurnId: null,
        steer: false,
        ...props,
        origin: props.origin ?? 'message',
        sourceKey: props.sourceKey ?? null,
        timeZone: props.timeZone ?? null,
        credentialScopes: props.credentialScopes ?? null,
        status: 'queued',
        error: null,
        failure: null,
        inputTokens: 0,
        outputTokens: 0,
        context: null,
        planLimits: null,
        cancelRequestedAt: null,
        startedAt: null,
        endedAt: null,
      },
    });
    turn.validate();
    return turn;
  }

  /**
   * A turn another bot's `message_bot` or `ask_bot` call queues on this bot
   * (`25-bots.md` §4.6): in the `bots` lane, one bot deeper in the asking
   * turn's chain, marked with the bot and turn that asked. It runs on the
   * receiving bot's own engine, and is sent with no more reach than the
   * asking turn had: the same requester, zone and credential scopes.
   */
  static queueFromBot(
    asker: BotTurnEntity,
    props: {
      botId: string;
      provider: BotProvider;
      model: string;
      effort: SessionEffort | null;
      replyRequested: boolean;
    },
  ): BotTurnEntity {
    return BotTurnEntity.queue({
      ...props,
      organizationId: asker.organizationId,
      requestedByUserId: asker.requireRequester(),
      timeZone: asker.timeZone,
      credentialScopes: asker.credentialScopes,
      lane: 'bots',
      chainId: asker.chainRoot,
      chainDepth: asker.chainDepth + 1,
      askedByBotId: asker.botId,
      askedByTurnId: asker.id,
    });
  }

  /**
   * The answer to an `ask_bot` call, queued on the bot that asked once the
   * asked turn ended: in the `bots` lane, at the asker's depth in the chain,
   * marked as from the bot that answered and as answering its turn.
   */
  static queueAnswer(
    answered: BotTurnEntity,
    props: {
      botId: string;
      provider: BotProvider;
      model: string;
      effort: SessionEffort | null;
    },
  ): BotTurnEntity {
    if (!answered.replyRequested || !answered.ended) {
      throw new ArgumentInvalidException('Only an ended ask is answered');
    }
    return BotTurnEntity.queue({
      ...props,
      organizationId: answered.organizationId,
      requestedByUserId: answered.requireRequester(),
      timeZone: answered.timeZone,
      credentialScopes: answered.credentialScopes,
      lane: 'bots',
      chainId: answered.chainRoot,
      chainDepth: Math.max(0, answered.chainDepth - 1),
      askedByBotId: answered.botId,
      askedByTurnId: answered.id,
      answersTurnId: answered.id,
    });
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
  get origin(): BotTurnOrigin {
    return this.props.origin;
  }
  get sourceKey(): string | null {
    return this.props.sourceKey;
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
  get lane(): BotTurnLane {
    return this.props.lane;
  }
  get chainId(): string | null {
    return this.props.chainId;
  }
  /** The chain this turn belongs to: its own id when it started one. */
  get chainRoot(): string {
    return this.props.chainId ?? this.id;
  }
  get chainDepth(): number {
    return this.props.chainDepth;
  }
  get askedByBotId(): string | null {
    return this.props.askedByBotId;
  }
  get askedByTurnId(): string | null {
    return this.props.askedByTurnId;
  }
  get replyRequested(): boolean {
    return this.props.replyRequested;
  }
  get answersTurnId(): string | null {
    return this.props.answersTurnId;
  }
  get steer(): boolean {
    return this.props.steer;
  }
  get timeZone(): string | null {
    return this.props.timeZone;
  }
  get credentialScopes(): readonly Scope[] | null {
    return this.props.credentialScopes;
  }
  get effort(): SessionEffort | null {
    return this.props.effort;
  }
  get error(): string | null {
    return this.props.error;
  }

  get failure(): BotTurnFailure | null {
    return this.props.failure;
  }
  get inputTokens(): number {
    return this.props.inputTokens;
  }
  get outputTokens(): number {
    return this.props.outputTokens;
  }
  get context(): BotTurnContext | null {
    return this.props.context;
  }
  get planLimits(): BotTurnPlanLimits | null {
    return this.props.planLimits;
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
    outcome: {
      error?: string | null;
      failure?: BotTurnFailure | null;
      inputTokens?: number;
      outputTokens?: number;
      context?: BotTurnContext | null;
      planLimits?: BotTurnPlanLimits | null;
    } = {},
  ): void {
    if (this.ended) throw new ArgumentInvalidException(`The turn already ${this.props.status}`);
    this.props.status = status;
    this.props.endedAt = now;
    this.props.error = status === 'failed' ? fitError(outcome.error ?? 'The turn failed') : null;
    this.props.failure = status === 'failed' ? (outcome.failure ?? 'other') : null;
    this.props.inputTokens = outcome.inputTokens ?? this.props.inputTokens;
    this.props.outputTokens = outcome.outputTokens ?? this.props.outputTokens;
    this.props.context = outcome.context ?? this.props.context;
    this.props.planLimits = outcome.planLimits ?? this.props.planLimits;
  }

  /** A worker found it running: the one that ran it died, so it fails rather than running twice. */
  abandon(now: Date): void {
    this.end('failed', now, {
      error: 'The turn was interrupted. Send the message again.',
      failure: 'interrupted',
    });
  }

  /** Who sent the message the turn answers; a turn whose sender's account is gone queues nothing more. */
  private requireRequester(): string {
    if (!this.props.requestedByUserId) {
      throw new ArgumentInvalidException("The turn's sender no longer has an account");
    }
    return this.props.requestedByUserId;
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
    if (!BOT_TURN_LANES.includes(props.lane)) {
      throw new ArgumentInvalidException(`${props.lane} is not a turn lane`);
    }
    if (!Number.isInteger(props.chainDepth) || props.chainDepth < 0) {
      throw new ArgumentInvalidException('A chain depth is a whole number from 0');
    }
    if (props.lane === 'bots' && props.chainId === null) {
      throw new ArgumentInvalidException('A turn a bot queued belongs to its chain');
    }
    if (props.steer && (props.lane !== 'owner' || props.origin !== 'message')) {
      throw new ArgumentInvalidException('Only a message of yours steers');
    }
    if (props.answersTurnId && props.replyRequested) {
      throw new ArgumentInvalidException('An answer asks for no answer');
    }
  }
}

/** `error` cut to `BOT_TURN_ERROR_MAX` characters, an ellipsis marking the cut, never half a pair. */
function fitError(error: string): string {
  if (error.length <= BOT_TURN_ERROR_MAX) return error;
  return `${error.slice(0, BOT_TURN_ERROR_MAX - 1).replace(/[\uD800-\uDBFF]$/, '')}…`;
}
