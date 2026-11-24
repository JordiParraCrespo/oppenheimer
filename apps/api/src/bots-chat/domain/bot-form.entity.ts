import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_APPROVAL_NOTE_MAX,
  BOT_FORM_STATUSES,
  type BotFormSpec,
  type BotFormStatus,
  type BotFormValues,
  type Scope,
} from '@oppenheimer/shared';
import { formSpecProblem, formValuesOf } from './bot-form-values.policy';

export interface BotFormProps {
  organizationId: string;
  botId: string;
  /** The turn whose `ask_form` call asked. */
  turnId: string;
  spec: BotFormSpec;
  status: BotFormStatus;
  /** A value per field id, once submitted; null before, and when dismissed or expired. */
  values: BotFormValues | null;
  /** The person's note with a dismissal. */
  note: string | null;
  decidedByUserId: string | null;
  /** The deciding credential's scopes; null for a browser session (or while pending). */
  decidedWithScopes: readonly Scope[] | null;
  decidedAt: Date | null;
}

/**
 * A form a bot asked its owner to fill (`ask_form`). It is decided once:
 * `pending` moves to `submitted`, `dismissed` or `expired`, never back, and
 * nothing runs on it. The status it was loaded in is what its next write is
 * conditioned on, so two submissions, or one and a new message, never both
 * land.
 */
export class BotFormEntity extends AggregateRoot<BotFormProps> {
  private loadedStatus: BotFormStatus;

  constructor(create: CreateEntityProps<BotFormProps>) {
    super(create);
    this.loadedStatus = create.props.status;
  }

  static create(create: CreateEntityProps<BotFormProps>): BotFormEntity {
    return new BotFormEntity(create);
  }

  static ask(props: {
    organizationId: string;
    botId: string;
    turnId: string;
    spec: BotFormSpec;
  }): BotFormEntity {
    const form = new BotFormEntity({
      id: randomUUID(),
      props: {
        ...props,
        status: 'pending',
        values: null,
        note: null,
        decidedByUserId: null,
        decidedWithScopes: null,
        decidedAt: null,
      },
    });
    form.validate();
    return form;
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
  get spec(): BotFormSpec {
    return this.props.spec;
  }
  /** The form's line: its title. */
  get summary(): string {
    return this.props.spec.title;
  }
  get status(): BotFormStatus {
    return this.props.status;
  }
  get statusAtLoad(): BotFormStatus {
    return this.loadedStatus;
  }
  get values(): Readonly<BotFormValues> | null {
    return this.props.values;
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

  /** Why these values cannot fill this form, in words; null when they can. */
  valuesProblem(values: Readonly<Record<string, unknown>>): string | null {
    const read = formValuesOf(this.props.spec, values);
    return 'problem' in read ? read.problem : null;
  }

  /** The owner submitted the form, through a credential with these scopes (null for a browser session). */
  submit(
    userId: string,
    now: Date,
    values: Readonly<Record<string, unknown>>,
    scopes: readonly Scope[] | null = null,
  ): void {
    const read = formValuesOf(this.props.spec, values);
    if ('problem' in read) throw new ArgumentInvalidException(read.problem);
    this.decide('submitted', userId, now, scopes);
    this.props.values = read.values;
  }

  /** The owner declined to fill it, with what they added. */
  dismiss(
    userId: string,
    now: Date,
    note?: string | null,
    scopes: readonly Scope[] | null = null,
  ): void {
    this.decide('dismissed', userId, now, scopes);
    const trimmed = note?.trim();
    this.props.note = trimmed ? Array.from(trimmed).slice(0, BOT_APPROVAL_NOTE_MAX).join('') : null;
  }

  /** The owner wrote to the bot instead of filling it: the form is gone, nobody decided. */
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
    status: 'submitted' | 'dismissed',
    userId: string,
    now: Date,
    scopes: readonly Scope[] | null,
  ): void {
    this.requirePending();
    if (!userId) throw new ArgumentNotProvidedException('Somebody decides a form');
    this.props.status = status;
    this.props.decidedByUserId = userId;
    this.props.decidedWithScopes = scopes ? [...scopes] : null;
    this.props.decidedAt = now;
  }

  private requirePending(): void {
    if (this.props.status !== 'pending') {
      throw new ArgumentInvalidException(`The form is already ${this.props.status}`);
    }
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId || !props.turnId) {
      throw new ArgumentNotProvidedException('A form belongs to a turn of a bot');
    }
    const problem = formSpecProblem(props.spec);
    if (problem) throw new ArgumentInvalidException(problem);
    if (!BOT_FORM_STATUSES.includes(props.status)) {
      throw new ArgumentInvalidException(`${props.status} is not a form's status`);
    }
  }
}
