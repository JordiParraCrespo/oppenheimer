import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentOutOfRangeException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { GOOGLE_CALENDAR_ACCOUNTS_MAX } from '@oppenheimer/shared';

export type CalendarConnectionStatus = 'active' | 'revoked';

export interface CalendarConnectionProps {
  organizationId: string;
  /** Whose Google account it is. Only they read it. */
  userId: string;
  provider: 'google';
  accountEmail: string;
  /** Google's `sub`: what tells one account from another. Null on a row from before it was kept. */
  accountSubject: string | null;
  /** The account's colour on the month, 0–4: picked once, never reassigned. */
  colorIndex: number;
  /** The refresh token, sealed under the calendar key; never in the clear at rest. */
  refreshTokenSealed: Buffer;
  scopes: string[];
  status: CalendarConnectionStatus;
}

/** What a fresh grant from Google says about the account it is for. */
export interface CalendarGrantProps {
  accountEmail: string;
  accountSubject: string;
  refreshTokenSealed: Buffer;
  scopes: string[];
}

/**
 * One of a person's Google accounts, read-only (`product/versions/mvp/20-plan-calendar.md`
 * §4, several per person since `23-plan-milestones-stats-accounts.md` §5). A grant
 * of their own, separate from Google sign-in; nothing of the calendar is stored,
 * only what it takes to read it.
 */
export class CalendarConnectionEntity extends AggregateRoot<CalendarConnectionProps> {
  static create(create: CreateEntityProps<CalendarConnectionProps>): CalendarConnectionEntity {
    return new CalendarConnectionEntity(create);
  }

  static connect(
    props: Omit<CalendarConnectionProps, 'status' | 'provider'>,
  ): CalendarConnectionEntity {
    return new CalendarConnectionEntity({
      id: randomUUID(),
      props: { ...props, provider: 'google', status: 'active' },
    });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get provider(): 'google' {
    return this.props.provider;
  }
  get accountEmail(): string {
    return this.props.accountEmail;
  }
  get accountSubject(): string | null {
    return this.props.accountSubject;
  }
  get colorIndex(): number {
    return this.props.colorIndex;
  }
  get refreshTokenSealed(): Buffer {
    return this.props.refreshTokenSealed;
  }
  get scopes(): string[] {
    return [...this.props.scopes];
  }
  get status(): CalendarConnectionStatus {
    return this.props.status;
  }
  get isActive(): boolean {
    return this.props.status === 'active';
  }

  /** Google said the grant is gone; the card offers Reconnect. */
  revoke(): void {
    this.props.status = 'revoked';
    this.setUpdatedAt(new Date());
  }

  /**
   * The same account granted again (Reconnect, or connecting it a second time):
   * the new grant replaces the old one and the account is active again. Its
   * colour stays.
   */
  reconnect(grant: CalendarGrantProps): void {
    this.props.accountEmail = grant.accountEmail;
    this.props.accountSubject = grant.accountSubject;
    this.props.refreshTokenSealed = grant.refreshTokenSealed;
    this.props.scopes = [...grant.scopes];
    this.props.status = 'active';
    this.setUpdatedAt(new Date());
  }

  /** Whether a fresh grant is for this account: its subject, or its address on a row kept without one. */
  isAccountOf(grant: Pick<CalendarGrantProps, 'accountEmail' | 'accountSubject'>): boolean {
    if (this.props.accountSubject !== null)
      return this.props.accountSubject === grant.accountSubject;
    return this.props.accountEmail.toLowerCase() === grant.accountEmail.toLowerCase();
  }

  public validate(): void {
    const { colorIndex } = this.props;
    if (
      !Number.isInteger(colorIndex) ||
      colorIndex < 0 ||
      colorIndex >= GOOGLE_CALENDAR_ACCOUNTS_MAX
    ) {
      throw new ArgumentOutOfRangeException(
        `colorIndex must be 0 to ${GOOGLE_CALENDAR_ACCOUNTS_MAX - 1}`,
      );
    }
  }
}
