import { randomUUID } from 'node:crypto';
import { AggregateRoot, type CreateEntityProps } from '@oppenheimer/backend-ddd';

export type CalendarConnectionStatus = 'active' | 'revoked';

export interface CalendarConnectionProps {
  organizationId: string;
  /** Whose Google account it is. Only they read it. */
  userId: string;
  provider: 'google';
  accountEmail: string;
  /** The refresh token, sealed under the calendar key; never in the clear at rest. */
  refreshTokenSealed: Buffer;
  scopes: string[];
  status: CalendarConnectionStatus;
}

/**
 * A person's Google Calendar, read-only (`product/versions/mvp/20-plan-calendar.md`
 * §4). A grant of their own, separate from Google sign-in; nothing of the calendar
 * is stored, only what it takes to read it.
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

  public validate(): void {}
}
