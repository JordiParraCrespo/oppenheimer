import type {
  BotApprovalStatus,
  BotMessageEvent,
  BotMessageRole,
  BotProvider,
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
  ) {}
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
