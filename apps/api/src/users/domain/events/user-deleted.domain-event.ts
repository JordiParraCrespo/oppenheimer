import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a user is removed from the system. Consumers (email, analytics,
 * downstream cleanup) react to this without the deletion flow knowing about
 * them.
 */
export class UserDeletedDomainEvent extends DomainEvent {
  readonly email: string;

  constructor(props: DomainEventProps<UserDeletedDomainEvent>) {
    super(props);
    this.email = props.email;
  }
}
