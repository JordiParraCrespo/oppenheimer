import type { BotApprovalEvent, BotStreamEvent } from '@oppenheimer/shared/schemas/bot';
import type { BotApprovalEntity, BotConversationEntity } from './bot-conversation.entity';

/**
 * A bot's Needs input cards as the stream tells of them, before any read
 * (Codex's `serverRequest/resolved`, and its rule that an approval waits for
 * the sentence being written): a card some tab or device decided, drawn as
 * its line until the conversation holds it, and a card raised while the
 * bot's text is half a line, held until the line ends.
 */

type ResolvedFrame = Extract<BotStreamEvent, { type: 'approval_resolved' }>;

/** Cards decided while the chat was open, as the lines they will be, oldest first. */
export type BotResolvedApprovals = readonly BotApprovalEvent[];

export const NO_RESOLVED_APPROVALS: BotResolvedApprovals = [];

/**
 * How many decided cards wait for their stored line at once. A bot has one
 * card up at a time, so a handful is plenty; past it the oldest goes.
 */
export const RESOLVED_APPROVALS_MAX = 10;

/**
 * A card closed: kept as its decided line, at most
 * {@link RESOLVED_APPROVALS_MAX} of them. A card retired by a new message
 * (`expired`) has no line, and one already kept is kept once.
 */
export function noteResolvedApproval(
  resolved: BotResolvedApprovals,
  frame: ResolvedFrame,
): BotResolvedApprovals {
  if (frame.outcome === 'expired') return resolved;
  if (resolved.some((line) => line.approvalId === frame.approvalId)) return resolved;
  return [
    ...resolved.slice(-(RESOLVED_APPROVALS_MAX - 1)),
    {
      kind: 'approval',
      outcome: frame.outcome,
      tool: frame.tool,
      summary: frame.summary,
      sessionId: null,
      approvalId: frame.approvalId,
    },
  ];
}

/**
 * The decided cards whose own line the conversation does not hold yet: what
 * to draw after the stored chat, so a read landing early or late never draws
 * a decision twice. It is also how a kept card is retired for good: once a
 * read has held its line, `useBotLive` drops it, so a line that later leaves
 * the conversation's window never brings the early one back.
 */
export function botResolvedApprovals(
  resolved: BotResolvedApprovals,
  conversation: BotConversationEntity,
): BotResolvedApprovals {
  if (resolved.length === 0) return resolved;
  const stored = new Set(
    conversation.messages.flatMap((message) =>
      message.event?.kind === 'approval' && message.event.approvalId
        ? [message.event.approvalId]
        : [],
    ),
  );
  const pending = resolved.filter((line) => !stored.has(line.approvalId ?? ''));
  return pending.length === resolved.length ? resolved : pending;
}

/** The card the chat shows, once the stream says `approvalId` closed: gone, if it is that one. */
export function withoutClosedApproval(
  card: BotApprovalEntity | null | undefined,
  approvalId: string,
): BotApprovalEntity | null | undefined {
  return card?.id === approvalId ? null : card;
}

/** How long a card raised mid-sentence waits for the line to end, at most. */
export const APPROVAL_HOLD_MAX_MS = 600;

/**
 * Holds a card raised while the bot's live text is half a line, so it does
 * not land in the middle of a sentence: it is shown when a line ends (a
 * newline arrives, the text is stored, the turn moves) or after
 * {@link APPROVAL_HOLD_MAX_MS}, whichever is first. A card raised between
 * lines shows at once.
 */
export class BotApprovalHold {
  private midLine = false;
  private held: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly maxMs = APPROVAL_HOLD_MAX_MS) {}

  /** A `text` frame: a newline in it ends the line the card waited on. */
  text(chunk: string): void {
    if (!chunk) return;
    const ended = chunk.includes('\n');
    this.midLine = !chunk.endsWith('\n');
    if (ended) this.release();
  }

  /** The text was stored, or the turn moved: whatever line there was has ended. */
  lineEnded(): void {
    this.midLine = false;
    this.release();
  }

  /** A card was raised: `show` it now, or once the line ends. */
  raise(show: () => void): void {
    if (!this.midLine) {
      show();
      return;
    }
    this.held = show;
    this.timer ??= setTimeout(() => this.release(), this.maxMs);
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.held = null;
  }

  private release(): void {
    const show = this.held;
    this.dispose();
    show?.();
  }
}
