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
  BOT_ASK_USER_TOOL,
  type BotApprovalReach,
  type BotApprovalStatus,
  type BotQuestion,
  type BotQuestionAnswer,
  botQuestionsSchema,
  type Scope,
} from '@oppenheimer/shared';
import { BotToolPermissionEntity, type BotToolSubject } from './bot-tool-permission.entity';
import { reachesFor } from './bot-tool-permission.policy';
import { BotApprovalChangedDomainEvent } from './events/bot-approval-changed.domain-event';

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
  /** The one thing the call acts on, when the tool names one: what "Always allow for …" covers. */
  subject: BotToolSubject | null;
  /** The call sends data out of Oppenheimer; the card says so. */
  sharesOutside: boolean;
  /** The tool is decided call by call: the card offers this call only. */
  perCallOnly: boolean;
  /** Why a rule paused the call, when one did. */
  reviewNote: string | null;
  /** How far the yes went; null while pending and on any other outcome. */
  reach: BotApprovalReach | null;
  status: BotApprovalStatus;
  /** The tool's answer once it ran on a yes; null before, and for a no. */
  result: string | null;
  /** The session the call started when it ran on the yes (`start_session`); null when it started none. */
  sessionId: string | null;
  /** The person's note with a no. */
  note: string | null;
  /** What a card of questions was answered with, one per question; null until it is. */
  answers: BotQuestionAnswer[] | null;
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
/** How long the line saying why a rule paused a call may be. */
export const BOT_APPROVAL_REVIEW_NOTE_MAX = 400;

/**
 * One call of an asking tool waiting for the bot's owner (`25-bots.md` §5,
 * the Needs input card). It is decided once: `pending` moves to `approved`,
 * `denied` or `expired`, and an approved call that failed when it ran ends
 * `failed`. Approved with no result yet is a call running. The status it was loaded in is what its next write is
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
    subject?: BotToolSubject | null;
    sharesOutside?: boolean;
    perCallOnly?: boolean;
    reviewNote?: string | null;
  }): BotApprovalEntity {
    const approval = new BotApprovalEntity({
      id: randomUUID(),
      props: {
        ...props,
        summary: cut(props.summary.trim(), BOT_APPROVAL_SUMMARY_MAX),
        subject: props.subject ?? null,
        sharesOutside: props.sharesOutside ?? false,
        perCallOnly: props.perCallOnly ?? false,
        reviewNote: props.reviewNote
          ? cut(props.reviewNote.trim(), BOT_APPROVAL_REVIEW_NOTE_MAX)
          : null,
        reach: null,
        status: 'pending',
        result: null,
        sessionId: null,
        note: null,
        answers: null,
        decidedByUserId: null,
        decidedWithScopes: null,
        decidedAt: null,
      },
    });
    approval.validate();
    approval.announce('raised');
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
  get sessionId(): string | null {
    return this.props.sessionId;
  }
  get subject(): BotToolSubject | null {
    return this.props.subject;
  }
  get sharesOutside(): boolean {
    return this.props.sharesOutside;
  }
  get perCallOnly(): boolean {
    return this.props.perCallOnly;
  }
  get reviewNote(): string | null {
    return this.props.reviewNote;
  }
  get reach(): BotApprovalReach | null {
    return this.props.reach;
  }
  /** A card of questions (`ask_user`): answered or dismissed, never approved, and nothing runs. */
  get isQuestion(): boolean {
    return this.props.tool === BOT_ASK_USER_TOOL;
  }
  /** The questions of a card of them, as stored; empty for any other card. */
  get questions(): BotQuestion[] {
    if (!this.isQuestion) return [];
    const parsed = botQuestionsSchema.safeParse(this.props.input);
    return parsed.success ? parsed.data.questions : [];
  }
  get answers(): BotQuestionAnswer[] | null {
    return this.props.answers;
  }
  /** How far a yes may reach for this call: this call, its subject, the tool. None for questions. */
  get reaches(): BotApprovalReach[] {
    if (this.isQuestion) return [];
    return reachesFor(
      { name: this.props.tool, asks: true, perCallOnly: this.props.perCallOnly },
      this.props.subject,
    );
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

  /**
   * The owner said yes, through a credential with these scopes (null for a
   * browser session), reaching as far as `reach`: this call, every call on
   * its subject, or every call of the tool. Only a reach the card offers.
   * Only a pending approval is decided; it then runs.
   */
  approve(
    userId: string,
    now: Date,
    scopes: readonly Scope[] | null = null,
    reach: BotApprovalReach = 'once',
  ): void {
    if (this.isQuestion) throw new ArgumentInvalidException('A card of questions is answered');
    if (!this.reaches.includes(reach)) {
      throw new ArgumentInvalidException(`This approval cannot reach "${reach}"`);
    }
    this.decide('approved', userId, now, scopes);
    this.props.reach = reach;
  }

  /**
   * What a yes past this call leaves standing (`25-bots.md` §5): "Always
   * allow" sets the tool to Allow for the bot; "Always allow for …" grants it
   * on the call's subject. Null for a yes to this call only, and for a no.
   */
  standing(): BotToolPermissionEntity | null {
    const { organizationId, botId, tool, decidedByUserId: userId, subject } = this.props;
    if (this.props.status !== 'approved') return null;
    if (this.props.reach === 'tool') {
      return BotToolPermissionEntity.decide({
        organizationId,
        botId,
        tool,
        decision: 'allow',
        userId,
      });
    }
    if (this.props.reach === 'subject' && subject) {
      return BotToolPermissionEntity.grant({ organizationId, botId, tool, subject, userId });
    }
    return null;
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

  /**
   * The owner answered a card of questions: one answer per question, each
   * picking options it has (one at most where only one may be picked) or
   * saying something in their own words. Only a pending card of questions.
   */
  answer(
    userId: string,
    now: Date,
    answers: readonly BotQuestionAnswer[],
    scopes: readonly Scope[] | null = null,
  ): void {
    const problem = this.answersProblem(answers);
    if (problem) throw new ArgumentInvalidException(problem);
    this.decide('answered', userId, now, scopes);
    this.props.answers = answers.map((answer) => ({
      picks: [...new Set(answer.picks)].sort((a, b) => a - b),
      other: answer.other?.trim() || null,
    }));
  }

  /** Why these answers cannot answer this card, in words; null when they can. */
  answersProblem(answers: readonly BotQuestionAnswer[]): string | null {
    if (!this.isQuestion) return 'Only a card of questions is answered';
    return answersProblem(this.questions, answers);
  }

  /** The owner wrote to the bot instead of answering: the card is gone, nobody decided. */
  expire(now: Date): void {
    this.requirePending();
    this.props.status = 'expired';
    this.props.decidedAt = now;
    this.announce('expired: the owner wrote to the bot instead');
  }

  /**
   * What the call answered when it ran on the yes, and the session it
   * started; an error ends it `failed`, having started none. Once.
   */
  recordResult(result: string, failed: boolean, sessionId: string | null = null): void {
    if (!this.running) {
      throw new ArgumentInvalidException(`A ${this.props.status} approval has nothing running`);
    }
    this.props.result = cut(result, BOT_APPROVAL_RESULT_MAX);
    this.props.sessionId = failed ? null : sessionId;
    if (failed) this.props.status = 'failed';
    this.announce(failed ? 'its call failed' : 'its call ran');
  }

  /** The write that stored this instance landed: its next one is conditioned on what it holds now. */
  markPersisted(): void {
    this.loadedStatus = this.props.status;
  }

  private decide(
    status: 'approved' | 'denied' | 'answered',
    userId: string,
    now: Date,
    scopes: readonly Scope[] | null,
  ): void {
    this.requirePending();
    if (!userId) throw new ArgumentNotProvidedException('Somebody decides an approval');
    this.props.status = status;
    this.props.decidedByUserId = userId;
    this.props.decidedWithScopes = scopes ? [...scopes] : null;
    this.props.decidedAt = now;
    this.announce(status);
  }

  /** The approval moved: the workspace's consoles re-read what lists it. */
  private announce(what: string): void {
    this.addEvent(
      new BotApprovalChangedDomainEvent({
        aggregateId: this.id,
        organizationId: this.props.organizationId,
        botId: this.props.botId,
        status: this.props.status,
        reason: `bot ${this.props.botId}: approval ${this.id} ${what}`,
      }),
    );
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

/** Why these answers do not fit these questions, or null when they do. */
function answersProblem(
  questions: readonly BotQuestion[],
  answers: readonly BotQuestionAnswer[],
): string | null {
  if (questions.length === 0) return 'The card holds no questions to answer';
  if (answers.length !== questions.length) {
    return `${questions.length} question(s) take ${questions.length} answer(s), not ${answers.length}`;
  }
  for (const [index, question] of questions.entries()) {
    const { picks, other } = answers[index] as BotQuestionAnswer;
    const n = index + 1;
    if (picks.some((pick) => pick < 0 || pick >= question.options.length)) {
      return `Question ${n} has ${question.options.length} options`;
    }
    if (!question.multiSelect && new Set(picks).size > 1) {
      return `Question ${n} takes one option`;
    }
    if (picks.length === 0 && !other?.trim()) return `Question ${n} is not answered`;
  }
  return null;
}

/** `text` cut to `max` characters, an ellipsis marking the cut, never half a pair. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, '')}…`;
}
