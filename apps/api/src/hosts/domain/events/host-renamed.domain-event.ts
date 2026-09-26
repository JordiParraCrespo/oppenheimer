import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/** Raised when a host is renamed; the host's timeline records it. */
export class HostRenamedDomainEvent extends DomainEvent {
  readonly from: string;
  readonly to: string;

  constructor(props: DomainEventProps<HostRenamedDomainEvent>) {
    super(props);
    this.from = props.from;
    this.to = props.to;
  }
}
