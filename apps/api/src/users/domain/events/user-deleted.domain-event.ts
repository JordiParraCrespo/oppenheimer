import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Lets consumers react to a deletion without the deletion flow knowing about
 * them.
 */
export class UserDeletedDomainEvent extends DomainEvent {
  readonly email: string;

  constructor(props: DomainEventProps<UserDeletedDomainEvent>) {
    super(props);
    this.email = props.email;
  }
}
