import type { BotMessageRole, BotProvider, BotTurnStatus } from '@oppenheimer/shared/schemas/bot';

/** One tool call in an activity line: what the bot asked for and what came back. */
export interface BotToolStep {
  callId: string;
  /** The tool, as the bot knows it. */
  name: string;
  input: Record<string, unknown>;
  /** What it answered, cut short; `null` while it runs. */
  output: string | null;
  isError: boolean;
}

/**
 * One line of a bot's chat (`product/versions/mvp/25-bots.md` §3): your
 * message, the bot's text, or an activity line holding a run of tool calls.
 */
export class BotMessageEntity {
  constructor(
    public readonly id: string,
    public readonly turnId: string,
    public readonly role: BotMessageRole,
    /** The text; empty for an activity line. */
    public readonly content: string,
    public readonly steps: readonly BotToolStep[],
    public readonly createdAt: Date,
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
  ) {}

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
