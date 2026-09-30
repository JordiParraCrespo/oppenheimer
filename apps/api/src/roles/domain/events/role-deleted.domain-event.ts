import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

export class RoleDeletedDomainEvent extends DomainEvent {
  readonly name: string;

  constructor(props: DomainEventProps<RoleDeletedDomainEvent>) {
    super(props);
    this.name = props.name;
  }
}
