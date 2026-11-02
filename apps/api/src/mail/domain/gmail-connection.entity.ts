import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { GMAIL_LABEL_MAX } from '@oppenheimer/shared';

export type GmailConnectionStatus = 'active' | 'revoked';

export interface GmailConnectionProps {
  organizationId: string;
  /** Whose Gmail it is. Only they, and their bots, use it. */
  userId: string;
  /** Google's `sub`: what tells one account from another, whatever its address becomes. */
  googleSubject: string;
  accountEmail: string;
  /** What the person and their bots call it: "Personal", "Work". */
  label: string;
  /** The refresh token, sealed under the mail key; never in the clear at rest. */
  refreshTokenSealed: Buffer;
  scopes: string[];
  status: GmailConnectionStatus;
  /**
   * Where the poll for a watching routine last read the mailbox's history
   * (`mail.md` §5); null until a routine first watches it. Written only by
   * the poll, never by a save.
   */
  historyId?: string | null;
}

/** What a fresh grant from Google says about the account it is for. */
export interface GmailGrantProps {
  googleSubject: string;
  accountEmail: string;
  refreshTokenSealed: Buffer;
  scopes: string[];
}

/**
 * One of a person's Gmail accounts (`product/next-steps/mail.md` §1): a grant
 * of their own, separate from Google sign-in and from the calendar's. Nothing
 * of the mailbox is stored, only what it takes to reach it.
 */
export class GmailConnectionEntity extends AggregateRoot<GmailConnectionProps> {
  static create(create: CreateEntityProps<GmailConnectionProps>): GmailConnectionEntity {
    return new GmailConnectionEntity(create);
  }

  static connect(props: Omit<GmailConnectionProps, 'status'>): GmailConnectionEntity {
    return new GmailConnectionEntity({
      id: randomUUID(),
      props: { ...props, status: 'active' },
    });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get googleSubject(): string {
    return this.props.googleSubject;
  }
  get accountEmail(): string {
    return this.props.accountEmail;
  }
  get label(): string {
    return this.props.label;
  }
  get refreshTokenSealed(): Buffer {
    return this.props.refreshTokenSealed;
  }
  get scopes(): string[] {
    return [...this.props.scopes];
  }
  get status(): GmailConnectionStatus {
    return this.props.status;
  }
  get historyId(): string | null {
    return this.props.historyId ?? null;
  }
  get isActive(): boolean {
    return this.props.status === 'active';
  }

  /** Google said the grant is gone; Settings offers Reconnect. */
  revoke(): void {
    this.props.status = 'revoked';
    this.setUpdatedAt(new Date());
  }

  /**
   * The same account granted again (Reconnect, or connecting it a second
   * time): the new grant replaces the old one and the account is active
   * again. Its label stays.
   */
  reconnect(grant: GmailGrantProps): void {
    this.props.googleSubject = grant.googleSubject;
    this.props.accountEmail = grant.accountEmail;
    this.props.refreshTokenSealed = grant.refreshTokenSealed;
    this.props.scopes = [...grant.scopes];
    this.props.status = 'active';
    this.setUpdatedAt(new Date());
  }

  /** A blank label falls back to the address, so a bot can always name the account. */
  rename(label: string): void {
    const trimmed = label.trim();
    this.props.label = trimmed || this.props.accountEmail.slice(0, GMAIL_LABEL_MAX);
    this.validate();
    this.setUpdatedAt(new Date());
  }

  public validate(): void {
    const { label } = this.props;
    if (!label || label.length > GMAIL_LABEL_MAX) {
      throw new ArgumentInvalidException(`label must be 1 to ${GMAIL_LABEL_MAX} characters`);
    }
  }
}
