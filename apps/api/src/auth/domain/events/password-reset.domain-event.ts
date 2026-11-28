import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * An account's password was reset ("Forgot password", or an administrator's
 * set-password). Whoever held the account before may still hold credentials
 * it issued, so every module that owns a credential kind revokes the ones
 * issued up to `resetAt` (an ISO timestamp: the outbox delivers a plain
 * payload) that a reset takes back. `aggregateId` is the user.
 */
export class PasswordResetDomainEvent extends DomainEvent {
  readonly userId: string;
  readonly resetAt: string;

  constructor(props: DomainEventProps<PasswordResetDomainEvent>) {
    super(props);
    this.userId = props.userId;
    this.resetAt = props.resetAt;
  }
}
