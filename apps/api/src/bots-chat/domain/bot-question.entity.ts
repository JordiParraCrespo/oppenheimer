import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_APPROVAL_NOTE_MAX,
  BOT_QUESTION_STATUSES,
  BOT_QUESTIONS_MAX,
  type BotQuestion,
  type BotQuestionAnswer,
  type BotQuestionStatus,
  type Scope,
} from '@oppenheimer/shared';

export interface BotQuestionProps {
  organizationId: string;
  botId: string;
  /** The turn whose `ask_user` call asked. */
  turnId: string;
  questions: BotQuestion[];
  /** The card's line: the first question, and how many follow. */
  summary: string;
  status: BotQuestionStatus;
  /** One per question, once answered; null before, and when dismissed or expired. */
  answers: BotQuestionAnswer[] | null;
  /** The person's note with a dismissal. */
  note: string | null;
  decidedByUserId: string | null;
  /** The deciding credential's scopes; null for a browser session (or while pending). */
  decidedWithScopes: readonly Scope[] | null;
  decidedAt: Date | null;
}

/**
 * A card of questions a bot put to its owner (`ask_user`, `25-bots.md`
 * §3.2). It is decided once: `pending` moves to `answered`, `dismissed` or
 * `expired`, never back, and nothing runs on it. The status it was loaded
 * in is what its next write is conditioned on, so two answers, or an answer
 * and a new message, never both land.
 */
export class BotQuestionEntity extends AggregateRoot<BotQuestionProps> {
  private loadedStatus: BotQuestionStatus;

  constructor(create: CreateEntityProps<BotQuestionProps>) {
    super(create);
    this.loadedStatus = create.props.status;
  }

  static create(create: CreateEntityProps<BotQuestionProps>): BotQuestionEntity {
    return new BotQuestionEntity(create);
  }

  static ask(props: {
    organizationId: string;
    botId: string;
    turnId: string;
    questions: BotQuestion[];
    summary: string;
  }): BotQuestionEntity {
    const question = new BotQuestionEntity({
      id: randomUUID(),
      props: {
        ...props,
        status: 'pending',
        answers: null,
        note: null,
        decidedByUserId: null,
        decidedWithScopes: null,
        decidedAt: null,
      },
    });
    question.validate();
    return question;
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
  get questions(): readonly BotQuestion[] {
    return this.props.questions;
  }
  get summary(): string {
    return this.props.summary;
  }
  get status(): BotQuestionStatus {
    return this.props.status;
  }
  get statusAtLoad(): BotQuestionStatus {
    return this.loadedStatus;
  }
  get answers(): readonly BotQuestionAnswer[] | null {
    return this.props.answers;
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
  get decidedAt(): Date | null {
    return this.props.decidedAt;
  }

  /**
   * Why these answers cannot answer this card, in words; null when they can:
   * one per question, each picking options it has (one at most where only
   * one may be picked) or saying something in the person's own words.
   */
  answersProblem(answers: readonly BotQuestionAnswer[]): string | null {
    const { questions } = this.props;
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

  /** The owner answered, through a credential with these scopes (null for a browser session). */
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

  /** The owner declined to answer, with what they added. */
  dismiss(
    userId: string,
    now: Date,
    note?: string | null,
    scopes: readonly Scope[] | null = null,
  ): void {
    this.decide('dismissed', userId, now, scopes);
    const trimmed = note?.trim();
    this.props.note = trimmed ? trimmed.slice(0, BOT_APPROVAL_NOTE_MAX) : null;
  }

  /** The owner wrote to the bot instead of answering: the card is gone, nobody decided. */
  expire(now: Date): void {
    this.requirePending();
    this.props.status = 'expired';
    this.props.decidedAt = now;
  }

  /** The write that stored this instance landed: its next one is conditioned on what it holds now. */
  markPersisted(): void {
    this.loadedStatus = this.props.status;
  }

  private decide(
    status: 'answered' | 'dismissed',
    userId: string,
    now: Date,
    scopes: readonly Scope[] | null,
  ): void {
    this.requirePending();
    if (!userId) throw new ArgumentNotProvidedException('Somebody decides a card');
    this.props.status = status;
    this.props.decidedByUserId = userId;
    this.props.decidedWithScopes = scopes ? [...scopes] : null;
    this.props.decidedAt = now;
  }

  private requirePending(): void {
    if (this.props.status !== 'pending') {
      throw new ArgumentInvalidException(`The card is already ${this.props.status}`);
    }
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId || !props.turnId) {
      throw new ArgumentNotProvidedException('A card of questions belongs to a turn of a bot');
    }
    if (props.questions.length < 1 || props.questions.length > BOT_QUESTIONS_MAX) {
      throw new ArgumentInvalidException(`A card holds 1 to ${BOT_QUESTIONS_MAX} questions`);
    }
    if (!props.summary) throw new ArgumentNotProvidedException('A card has a line');
    if (!BOT_QUESTION_STATUSES.includes(props.status)) {
      throw new ArgumentInvalidException(`${props.status} is not a card's status`);
    }
  }
}
