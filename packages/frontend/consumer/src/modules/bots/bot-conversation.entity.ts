import type {
  BotApprovalStatus,
  BotAttachment,
  BotMessageEvent,
  BotMessageRole,
  BotProvider,
  BotSubagentRun,
  BotTurnStatus,
} from '@oppenheimer/shared/schemas/bot';

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
  ) {}

  /** Queued or running: the chat shows it working, and Stop applies to it. */
  get isActive(): boolean {
    return this.status === 'queued' || this.status === 'running';
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
  ) {}

  get isPending(): boolean {
    return this.status === 'pending';
  }
}
