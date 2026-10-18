import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
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
  type Scope,
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
  /**
   * The digest of this card's call (`approvalCallDigest`): its id, tool and
   * input. A yes names it, so it approves the call the person was shown and
   * no other; the job checks it again before the call runs.
   */
  callDigest: string;
  /** Past this, nobody can decide the card: it is `expired` at the next look. */
  expiresAt: Date;
  status: BotApprovalStatus;
  /** The tool's answer once it ran on a yes; null before, and for a no. */
  result: string | null;
  /** The person's note with a no. */
  note: string | null;
  /** Who decided; null while pending, once expired, or once that account is gone. */
  decidedByUserId: string | null;
  /** The deciding credential's scopes; null for a browser session (or while pending). */
  decidedWithScopes: readonly Scope[] | null;
  decidedAt: Date | null;
}

/** How long a card's summary may be: a sentence or two, never the whole task. */
export const BOT_APPROVAL_SUMMARY_MAX = 500;
/** How much of the tool's answer an approval keeps. */
export const BOT_APPROVAL_RESULT_MAX = 2_000;
/** How long a card waits for its owner unless its tool says otherwise. */
export const BOT_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * One call of an asking tool waiting for the bot's owner (`25-bots.md` §5,
 * the Needs input card). It is decided once: `pending` moves to `approved`,
 * `denied` or `expired`, and an approved call that failed when it ran ends
 * `failed`. Approved with no result yet is a call running. The status it was loaded in is what its next write is
 * conditioned on, so two clicks, or a click and a new message, never both
 * decide it. It is decided only before `expiresAt`, and a yes must name the
 * call's digest, so it never approves a call other than the one shown.
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

  static request(
    props: {
      organizationId: string;
      botId: string;
      turnId: string;
      tool: string;
      input: Record<string, unknown>;
      summary: string;
    },
    now: Date = new Date(),
    ttlMs: number = BOT_APPROVAL_TTL_MS,
  ): BotApprovalEntity {
    const id = randomUUID();
    const approval = new BotApprovalEntity({
      id,
      props: {
        ...props,
        summary: cut(props.summary.trim(), BOT_APPROVAL_SUMMARY_MAX),
        callDigest: approvalCallDigest(id, props.tool, props.input),
        expiresAt: new Date(now.getTime() + ttlMs),
        status: 'pending',
        result: null,
        note: null,
        decidedByUserId: null,
        decidedWithScopes: null,
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
  get callDigest(): string {
    return this.props.callDigest;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
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
  get decidedWithScopes(): readonly Scope[] | null {
    return this.props.decidedWithScopes;
  }
  /** Approved and not run yet: its job is queued or running. */
  get running(): boolean {
    return this.props.status === 'approved' && this.props.result === null;
  }
  get decidedAt(): Date | null {
    return this.props.decidedAt;
  }

  /** Still pending, but past its time: nobody may decide it any more. */
  isExpiredAt(now: Date): boolean {
    return this.props.status === 'pending' && now.getTime() >= this.props.expiresAt.getTime();
  }

  /** Whether `digest` names this card's call. */
  isFor(digest: string): boolean {
    return sameDigest(digest, this.props.callDigest);
  }

  /** The stored call is still the one the card was raised with: its digest holds. */
  get callIntact(): boolean {
    return this.isFor(approvalCallDigest(this.id, this.props.tool, this.props.input));
  }

  /**
   * The owner said yes to the call `digest` names, through a credential with
   * these scopes (null for a browser session). Only a pending approval, before
   * it expires and for its own call, is decided; it then runs.
   */
  approve(userId: string, now: Date, digest: string, scopes: readonly Scope[] | null = null): void {
    if (!this.isFor(digest)) {
      throw new ArgumentInvalidException('The approval names a different call');
    }
    this.decide('approved', userId, now, scopes);
  }

  /** The owner said no, with what they added. Only a pending approval is decided. */
  deny(
    userId: string,
    now: Date,
    note?: string | null,
    scopes: readonly Scope[] | null = null,
  ): void {
    this.decide('denied', userId, now, scopes);
    const trimmed = note?.trim();
    this.props.note = trimmed ? cut(trimmed, BOT_APPROVAL_NOTE_MAX) : null;
  }

  /** The owner wrote to the bot instead of answering, or its time ran out: nobody decided. */
  expire(now: Date): void {
    this.requirePending();
    this.props.status = 'expired';
    this.props.decidedAt = now;
  }

  /** What the call answered when it ran on the yes; an error ends it `failed`. Once. */
  recordResult(result: string, failed: boolean): void {
    if (!this.running) {
      throw new ArgumentInvalidException(`A ${this.props.status} approval has nothing running`);
    }
    this.props.result = cut(result, BOT_APPROVAL_RESULT_MAX);
    if (failed) this.props.status = 'failed';
  }

  /** The write that stored this instance landed: its next one is conditioned on what it holds now. */
  markPersisted(): void {
    this.loadedStatus = this.props.status;
  }

  private decide(
    status: 'approved' | 'denied',
    userId: string,
    now: Date,
    scopes: readonly Scope[] | null,
  ): void {
    this.requirePending();
    if (this.isExpiredAt(now)) throw new ArgumentInvalidException('The approval expired');
    if (!userId) throw new ArgumentNotProvidedException('Somebody decides an approval');
    this.props.status = status;
    this.props.decidedByUserId = userId;
    this.props.decidedWithScopes = scopes ? [...scopes] : null;
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
    if (!/^[0-9a-f]{64}$/.test(props.callDigest)) {
      throw new ArgumentInvalidException('An approval carries its call’s digest');
    }
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

/**
 * What a card binds: its id, its tool and its input, as JSON with every
 * object's keys sorted (jsonb keeps no order), digested. The id is in it, so a
 * digest approves one card and never another card with the same call.
 */
export function approvalCallDigest(
  id: string,
  tool: string,
  input: Record<string, unknown>,
): string {
  return createHash('sha256').update(canonicalJson({ id, tool, input })).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function sameDigest(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
