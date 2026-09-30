import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Consumers (email, analytics, downstream cleanup) react to this without the
 * deletion flow knowing about them.
 */
export class UserDeletedDomainEvent extends DomainEvent {
  readonly email: string;

  constructor(props: DomainEventProps<UserDeletedDomainEvent>) {
    super(props);
    this.email = props.email;
  }
}
