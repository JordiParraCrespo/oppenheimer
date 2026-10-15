import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_APPROVAL_NOTE_MAX,
  BOT_APPROVAL_STATUSES,
  type BotApprovalStatus,
} from '@oppenheimer/shared';

export interface BotApprovalProps {
  organizationId: string;
  botId: string;
  /** The turn whose tool call asked. */
  turnId: string;
  /** The asking tool, as the bot knows it (`start_session`). */
  tool: string;
  /** The call's input exactly as the tool validated it: what runs on a yes, and nothing else. */
  input: Record<string, unknown>;
  /** What will happen, in words, built by the tool from its input. */
  summary: string;
  status: BotApprovalStatus;
  /** The tool's answer once it ran on a yes; null before, and for a no. */
  result: string | null;
  /** The person's note with a no. */
  note: string | null;
  /** Who decided; null while pending, once expired, or once that account is gone. */
  decidedByUserId: string | null;
  decidedAt: Date | null;
}

/** How long a card's summary may be: a sentence or two, never the whole task. */
export const BOT_APPROVAL_SUMMARY_MAX = 500;
/** How much of the tool's answer an approval keeps. */
export const BOT_APPROVAL_RESULT_MAX = 2_000;

/**
 * One call of an asking tool waiting for the bot's owner (`25-bots.md` §5,
 * the Needs input card). It is decided once: `pending` moves to `approved`,
 * `denied` or `expired`, and an approved call that failed when it ran ends
 * `failed`. The status it was loaded in is what its next write is
 * conditioned on, so two clicks, or a click and a new message, never both
 * decide it.
 */
export class BotApprovalEntity extends AggregateRoot<BotApprovalProps> {
  private loadedStatus: BotApprovalStatus;

  constructor(create: CreateEntityProps<BotApprovalProps>) {
    super(create);
    this.loadedStatus = create.props.status;
  }

  static create(create: CreateEntityProps<BotApprovalProps>): BotApprovalEntity {
    return new BotApprovalEntity(create);
  }

  static request(props: {
    organizationId: string;
    botId: string;
    turnId: string;
    tool: string;
    input: Record<string, unknown>;
    summary: string;
  }): BotApprovalEntity {
    const approval = new BotApprovalEntity({
      id: randomUUID(),
      props: {
        ...props,
        summary: cut(props.summary.trim(), BOT_APPROVAL_SUMMARY_MAX),
        status: 'pending',
        result: null,
        note: null,
        decidedByUserId: null,
        decidedAt: null,
      },
    });
    approval.validate();
    return approval;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get turnId(): string {
    return this.props.turnId;
  }
  get tool(): string {
    return this.props.tool;
  }
  get input(): Record<string, unknown> {
    return this.props.input;
  }
  get summary(): string {
    return this.props.summary;
  }
  get status(): BotApprovalStatus {
    return this.props.status;
  }
  get statusAtLoad(): BotApprovalStatus {
    return this.loadedStatus;
  }
  get result(): string | null {
    return this.props.result;
  }
  get note(): string | null {
    return this.props.note;
  }
  get decidedByUserId(): string | null {
    return this.props.decidedByUserId;
  }
  get decidedAt(): Date | null {
    return this.props.decidedAt;
  }

  /** The owner said yes. Only a pending approval is decided. */
  approve(userId: string, now: Date): void {
    this.decide('approved', userId, now);
  }

  /** The owner said no, with what they added. Only a pending approval is decided. */
  deny(userId: string, now: Date, note?: string | null): void {
    this.decide('denied', userId, now);
    const trimmed = note?.trim();
    this.props.note = trimmed ? cut(trimmed, BOT_APPROVAL_NOTE_MAX) : null;
  }

  /** The owner wrote to the bot instead of answering: the card is gone, nobody decided. */
  expire(now: Date): void {
    this.requirePending();
    this.props.status = 'expired';
    this.props.decidedAt = now;
  }

  /** What the call answered when it ran on the yes; an error ends it `failed`. */
  recordResult(result: string, failed: boolean): void {
    if (this.props.status !== 'approved') {
      throw new ArgumentInvalidException(`A ${this.props.status} approval ran nothing`);
    }
    this.props.result = cut(result, BOT_APPROVAL_RESULT_MAX);
    if (failed) this.props.status = 'failed';
  }

  /** The write that stored this instance landed: its next one is conditioned on what it holds now. */
  markPersisted(): void {
    this.loadedStatus = this.props.status;
  }

  private decide(status: 'approved' | 'denied', userId: string, now: Date): void {
    this.requirePending();
    if (!userId) throw new ArgumentNotProvidedException('Somebody decides an approval');
    this.props.status = status;
    this.props.decidedByUserId = userId;
    this.props.decidedAt = now;
  }

  private requirePending(): void {
    if (this.props.status !== 'pending') {
      throw new ArgumentInvalidException(`The approval is already ${this.props.status}`);
    }
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId || !props.turnId) {
      throw new ArgumentNotProvidedException('An approval belongs to a turn of a bot');
    }
    if (!props.tool) throw new ArgumentNotProvidedException('An approval is for a tool');
    if (!props.summary) throw new ArgumentNotProvidedException('An approval says what will happen');
    if (!BOT_APPROVAL_STATUSES.includes(props.status)) {
      throw new ArgumentInvalidException(`${props.status} is not an approval status`);
    }
  }
}

/** `text` cut to `max` characters, an ellipsis marking the cut, never half a pair. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, '')}…`;
}
