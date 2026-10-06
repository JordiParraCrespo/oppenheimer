import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/** Raised when a host is renamed; the host's timeline records it. */
export class HostRenamedDomainEvent extends DomainEvent {
  /** Absent on an event staged before it was carried; such a rename reaches no console. */
  readonly ownerUserId: string;
  readonly from: string;
  readonly to: string;

  constructor(props: DomainEventProps<HostRenamedDomainEvent>) {
    super(props);
    this.ownerUserId = props.ownerUserId;
    this.from = props.from;
    this.to = props.to;
  }
}
