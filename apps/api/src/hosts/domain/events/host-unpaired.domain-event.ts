import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a host stops being one — unpaired from the console, or reported
 * gone by its own uninstall.
 *
 * The relay listens so a link that is open at that moment is closed with the
 * terminal code rather than left up until its next heartbeat; the heartbeat
 * check is what still catches a link held by another API instance.
 */
export class HostUnpairedDomainEvent extends DomainEvent {
  readonly ownerUserId: string;

  constructor(props: DomainEventProps<HostUnpairedDomainEvent>) {
    super(props);
    this.ownerUserId = props.ownerUserId;
  }
}
