import { randomUUID } from 'node:crypto';
import { AggregateRoot, type CreateEntityProps } from '@oppenheimer/backend-ddd';
import type { MailPlan } from '@oppenheimer/shared';

/**
 * `scheduled` waits for its time; `sending` was claimed and Gmail asked;
 * `sent` and `failed` are how it ended; `cancelled` was stopped while it
 * waited.
 */
export type MailSendStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface MailSendProps {
  organizationId: string;
  userId: string;
  /** Null once the account it went from is disconnected; the record stays. */
  connectionId: string | null;
  botId: string | null;
  /** The approval it carries out: one send per approval, whatever retries. */
  approvalId: string;
  kind: 'new' | 'reply' | 'reply_all' | 'forward' | 'draft';
  accountEmail: string;
  recipients: string[];
  subject: string;
  status: MailSendStatus;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  sentAt: Date | null;
  /** When a scheduled send goes; null for one sent at once. */
  scheduledFor: Date | null;
  /**
   * The message a scheduled send goes out as, kept until it is sent: nobody
   * plans it again when its time comes. Null once sent, and for one sent at once.
   */
  plan: MailPlan | null;
}

/** What a send is claimed or scheduled with: who, from where, to whom, about what. */
export type MailSendClaim = Omit<
  MailSendProps,
  'status' | 'gmailMessageId' | 'gmailThreadId' | 'sentAt' | 'scheduledFor' | 'plan'
>;

/**
 * One message a bot sent, is sending or will send, from a person's Gmail
 * (`product/next-steps/mail.md` §3.4): claimed before Gmail is asked, so a
 * retried job never sends twice, and the record of what went out. The body
 * is not kept: Gmail's Sent folder has it.
 */
export class MailSendEntity extends AggregateRoot<MailSendProps> {
  static create(create: CreateEntityProps<MailSendProps>): MailSendEntity {
    return new MailSendEntity(create);
  }

  static claim(props: MailSendClaim): MailSendEntity {
    return new MailSendEntity({
      id: randomUUID(),
      props: {
        ...props,
        status: 'sending',
        gmailMessageId: null,
        gmailThreadId: null,
        sentAt: null,
        scheduledFor: null,
        plan: null,
      },
    });
  }

  /** A send that waits for `at`, keeping the message it will go out as. */
  static schedule(props: MailSendClaim, plan: MailPlan, at: Date): MailSendEntity {
    return new MailSendEntity({
      id: randomUUID(),
      props: {
        ...props,
        status: 'scheduled',
        gmailMessageId: null,
        gmailThreadId: null,
        sentAt: null,
        scheduledFor: at,
        plan,
      },
    });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get approvalId(): string {
    return this.props.approvalId;
  }
  get kind(): MailSendProps['kind'] {
    return this.props.kind;
  }
  get accountEmail(): string {
    return this.props.accountEmail;
  }
  get recipients(): string[] {
    return [...this.props.recipients];
  }
  get subject(): string {
    return this.props.subject;
  }
  get status(): MailSendStatus {
    return this.props.status;
  }
  get gmailMessageId(): string | null {
    return this.props.gmailMessageId;
  }
  get gmailThreadId(): string | null {
    return this.props.gmailThreadId;
  }
  get sentAt(): Date | null {
    return this.props.sentAt;
  }
  get connectionId(): string | null {
    return this.props.connectionId;
  }
  get botId(): string | null {
    return this.props.botId;
  }
  get scheduledFor(): Date | null {
    return this.props.scheduledFor;
  }
  get plan(): MailPlan | null {
    return this.props.plan;
  }

  sent(gmailMessageId: string, gmailThreadId: string, at: Date): void {
    this.props.status = 'sent';
    this.props.plan = null;
    this.props.gmailMessageId = gmailMessageId;
    this.props.gmailThreadId = gmailThreadId;
    this.props.sentAt = at;
    this.setUpdatedAt(at);
  }

  /** Gmail refused it: nothing went out, and it does not count against the day. */
  failed(at: Date): void {
    this.props.status = 'failed';
    this.props.plan = null;
    this.setUpdatedAt(at);
  }

  public validate(): void {}
}
