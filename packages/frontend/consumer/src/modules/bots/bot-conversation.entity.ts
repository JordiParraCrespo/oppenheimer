import type {
  BotApprovalReach,
  BotApprovalStatus,
  BotAttachment,
  BotMessageEvent,
  BotMessageRole,
  BotProvider,
  BotQuestion,
  BotQuestionStatus,
  BotSubagentRun,
  BotTurnFailure,
  BotTurnStatus,
} from '@oppenheimer/shared/schemas/bot';
import type { BotMailDraft, MailPlan } from '@oppenheimer/shared/schemas/mail';

/** One tool call in an activity line: what the bot asked for and what came back. */
export interface BotToolStep {
  callId: string;
  /** The tool, as the bot knows it. */
  name: string;
  input: Record<string, unknown>;
  /** What it answered, cut short; `null` while it runs. */
  output: string | null;
  isError: boolean;
  /** The session the call started (`start_session`), for the chat to open; `null` for any other. */
  sessionId: string | null;
  /** The subagents a `delegate` call ran, as they ended; `null` for any other call, and while it runs. */
  subagents: readonly BotSubagentRun[] | null;
  /** Why an asking call ran without a card: a standing grant, or the owner's rule; `null` otherwise. */
  allowedBy: string | null;
  /** The draft a mail call saved in Gmail, for the chat's card; `null` for any other call. */
  mailDraft: BotMailDraft | null;
}

/**
 * One line of a bot's chat (`product/versions/mvp/25-bots.md` §3): your
 * message, the bot's text, an activity line holding a run of tool calls, or
 * an event: what Oppenheimer told the bot for you (an approval decided).
 */
export class BotMessageEntity {
  constructor(
    public readonly id: string,
    /** The turn it belongs to; `null` for an event outside any turn (a routine changed, paused or failed). */
    public readonly turnId: string | null,
    public readonly role: BotMessageRole,
    /** The text; empty for an activity line. */
    public readonly content: string,
    public readonly steps: readonly BotToolStep[],
    public readonly createdAt: Date,
    /** What an event says happened, for the chat to draw; `null` on every other role. */
    public readonly event: BotMessageEvent | null = null,
    /** The images a message of yours carries, in the order you attached them; none on any other. */
    public readonly attachments: readonly BotAttachment[] = [],
  ) {}
}

/** What the model's context held: the tokens, against its window when the engine knew it. */
export interface BotTurnContext {
  tokens: number;
  window: number | null;
}

/** One of a subscription's usage windows: the share used, 0–100, and when it resets. */
export interface BotPlanWindow {
  usedPercent: number;
  resetsAt: Date | null;
}

/** A subscription's 5-hour and weekly windows (ChatGPT's); each null when left out. */
export interface BotPlanLimits {
  fiveHour: BotPlanWindow | null;
  sevenDay: BotPlanWindow | null;
}

/** A message of yours waiting behind the turn the bot is working on. */
export interface BotWaitingMessage {
  turnId: string;
  text: string;
  /** How many images it carries. */
  images: number;
}

/** The room a bot has left, as of its newest turn that said: its context, its plan. */
export interface BotRoomLeft {
  context: BotTurnContext | null;
  planLimits: BotPlanLimits | null;
}

/** One message of yours and what the bot did with it. */
export class BotTurnEntity {
  constructor(
    public readonly id: string,
    public readonly status: BotTurnStatus,
    public readonly provider: BotProvider,
    /** The model it runs on, fixed when it was sent. */
    public readonly model: string,
    /** Why it failed; `null` otherwise. */
    public readonly error: string | null,
    public readonly inputTokens: number,
    public readonly outputTokens: number,
    /** Stop was pressed and the worker has not ended it yet. */
    public readonly cancelRequested: boolean,
    public readonly createdAt: Date,
    public readonly startedAt: Date | null,
    public readonly endedAt: Date | null,
    /** What the context held at its last answer; `null` before one. */
    public readonly context: BotTurnContext | null = null,
    /** A subscription's windows as that answer said them; `null` on an API key. */
    public readonly planLimits: BotPlanLimits | null = null,
    /** What kind of failure it was, as the API recorded it; `null` unless it failed. */
    private readonly recordedFailure: BotTurnFailure | null = null,
  ) {}

  /** Queued or running: the chat shows it working, and Stop applies to it. */
  get isActive(): boolean {
    return this.status === 'queued' || this.status === 'running';
  }

  /**
   * What kind of failure it was; `null` unless it failed. A turn that failed
   * before the API recorded kinds reads as `other`.
   */
  get failure(): BotTurnFailure | null {
    if (this.status !== 'failed') return null;
    return this.recordedFailure ?? 'other';
  }
}

/** The newest messages of a chat, oldest first, and the turns they belong to. */
export class BotConversationEntity {
  constructor(
    public readonly messages: readonly BotMessageEntity[],
    /** Oldest first; any still queued or running are among them. */
    public readonly turns: readonly BotTurnEntity[],
    /** How many messages the chat holds in all, past this window; activity lines not counted. */
    public readonly messageCount: number,
  ) {}

  /** When the newest message was written; `null` for an empty chat. */
  get lastMessageAt(): Date | null {
    return this.messages.at(-1)?.createdAt ?? null;
  }

  /** The turn Stop applies to: the running one, else the oldest queued. */
  get activeTurn(): BotTurnEntity | null {
    return (
      this.turns.find((turn) => turn.status === 'running') ??
      this.turns.find((turn) => turn.status === 'queued') ??
      null
    );
  }

  /**
   * Your messages waiting behind the turn the bot is working on, oldest
   * first: the composer holds them, and the transcript draws each once its
   * turn starts. With nothing running, a queued turn is about to start and
   * stays in the transcript; one opened by an event, not a message of yours,
   * stays there too.
   */
  get waitingMessages(): readonly BotWaitingMessage[] {
    if (!this.turns.some((turn) => turn.status === 'running')) return [];
    return this.turns.flatMap((turn) => {
      if (turn.status !== 'queued') return [];
      const message = this.messages.find((m) => m.turnId === turn.id && m.role === 'user');
      return message
        ? [{ turnId: turn.id, text: message.content, images: message.attachments.length }]
        : [];
    });
  }

  /**
   * The room left as of the newest turn that reported each: its context, and
   * the plan's windows (a turn on an API key reports none, so an older
   * subscription turn's stand).
   */
  get roomLeft(): BotRoomLeft {
    let context: BotTurnContext | null = null;
    let planLimits: BotPlanLimits | null = null;
    for (let i = this.turns.length - 1; i >= 0 && (!context || !planLimits); i -= 1) {
      const turn = this.turns[i];
      context ??= turn?.context ?? null;
      planLimits ??= turn?.planLimits ?? null;
    }
    return { context, planLimits };
  }

  turn(id: string): BotTurnEntity | undefined {
    return this.turns.find((turn) => turn.id === id);
  }
}

/**
 * A Needs input card (`product/versions/mvp/25-bots.md` §5): one call the bot
 * asked to make, waiting for you, or what you decided about it.
 */
/**
 * What a Needs input card shows past its line (`25-bots.md` §5): the call as
 * it will run, the thing it acts on, whether it sends something out of
 * Oppenheimer, why a rule paused it, and the ways a yes may reach.
 */
export interface BotApprovalDetails {
  input: Readonly<Record<string, unknown>>;
  /** The thing it acts on, named (`acme/docs`); "Always allow for …" offers it. */
  subjectLabel: string | null;
  sharesOutside: boolean;
  /** Why a rule paused it, or that the rules could not be checked. */
  reviewNote: string | null;
  /** How far a yes may reach: this call, the call's subject, the tool. */
  reaches: readonly BotApprovalReach[];
  /** How far the yes went, once decided. */
  reach: BotApprovalReach | null;
}

const NO_APPROVAL_DETAILS: BotApprovalDetails = {
  input: {},
  subjectLabel: null,
  sharesOutside: false,
  reviewNote: null,
  reaches: ['once'],
  reach: null,
};

export class BotApprovalEntity {
  constructor(
    public readonly id: string,
    public readonly turnId: string,
    /** The tool, as the bot knows it (`start_session`). */
    public readonly tool: string,
    /** What will happen, in words. */
    public readonly summary: string,
    public readonly status: BotApprovalStatus,
    /** What the call answered when it ran; `null` before, and for a no. */
    public readonly result: string | null,
    public readonly createdAt: Date,
    /** What the card shows beyond its line, and how far a yes may reach. */
    public readonly details: BotApprovalDetails = NO_APPROVAL_DETAILS,
    /**
     * The message a send card sends on a yes, exactly (`product/next-steps/mail.md`
     * §3.4); `null` for every other card.
     */
    public readonly mail: MailPlan | null = null,
  ) {}

  get isPending(): boolean {
    return this.status === 'pending';
  }
}

/**
 * A card of questions a bot stopped on (`ask_user`,
 * `product/versions/mvp/25-bots.md` §3.2): answered or dismissed, never
 * approved, and nothing runs on it. A card of its own beside approvals; a
 * bot has one card up at a time of either kind.
 */
export class BotQuestionCardEntity {
  constructor(
    public readonly id: string,
    public readonly turnId: string,
    public readonly questions: readonly BotQuestion[],
    /** The card's line: its first question, and how many follow. */
    public readonly summary: string,
    public readonly status: BotQuestionStatus,
    public readonly createdAt: Date,
  ) {}
}

/**
 * A Needs input card as the workspace's list across its bots reads it (the
 * Inbox, `product/versions/mvp/29-inbox.md` §1): the card, the bot that
 * asked, and the call's input, where a session it concerns may be named.
 */
export class WorkspaceBotApprovalEntity extends BotApprovalEntity {
  constructor(
    approval: BotApprovalEntity,
    public readonly botId: string,
    public readonly botName: string,
    /** The session the call started on a yes; null before. */
    public readonly sessionId: string | null,
    /** The call exactly as it will run on a yes. */
    public readonly input: Readonly<Record<string, unknown>>,
  ) {
    super(
      approval.id,
      approval.turnId,
      approval.tool,
      approval.summary,
      approval.status,
      approval.result,
      approval.createdAt,
      approval.details,
      approval.mail,
    );
  }

  /**
   * The session this card concerns: the one it started, or the one its call
   * names (`session_id`), else none.
   */
  get concernsSessionId(): string | null {
    if (this.sessionId) return this.sessionId;
    const named = this.input.session_id ?? this.input.sessionId;
    return typeof named === 'string' && named ? named : null;
  }
}
