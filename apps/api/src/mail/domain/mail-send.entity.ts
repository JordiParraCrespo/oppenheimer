import { randomUUID } from 'node:crypto';
import { AggregateRoot, type CreateEntityProps } from '@oppenheimer/backend-ddd';

export type MailSendStatus = 'sending' | 'sent' | 'failed';

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
}

/**
 * One message a bot sent, or is sending, from a person's Gmail
 * (`product/next-steps/mail.md` §3.4): claimed before Gmail is asked, so a
 * retried job never sends twice, and the record of what went out. The body
 * is not kept: Gmail's Sent folder has it.
 */
export class MailSendEntity extends AggregateRoot<MailSendProps> {
  static create(create: CreateEntityProps<MailSendProps>): MailSendEntity {
    return new MailSendEntity(create);
  }

  static claim(
    props: Omit<MailSendProps, 'status' | 'gmailMessageId' | 'gmailThreadId' | 'sentAt'>,
  ): MailSendEntity {
    return new MailSendEntity({
      id: randomUUID(),
      props: {
        ...props,
        status: 'sending',
        gmailMessageId: null,
        gmailThreadId: null,
        sentAt: null,
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

  sent(gmailMessageId: string, gmailThreadId: string, at: Date): void {
    this.props.status = 'sent';
    this.props.gmailMessageId = gmailMessageId;
    this.props.gmailThreadId = gmailThreadId;
    this.props.sentAt = at;
    this.setUpdatedAt(at);
  }

  /** Gmail refused it: nothing went out, and it does not count against the day. */
  failed(at: Date): void {
    this.props.status = 'failed';
    this.setUpdatedAt(at);
  }

  public validate(): void {}
}
