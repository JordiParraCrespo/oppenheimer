import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

export class UserDeletedDomainEvent extends DomainEvent {
  readonly email: string;

  constructor(props: DomainEventProps<UserDeletedDomainEvent>) {
    super(props);
    this.email = props.email;
  }
}
