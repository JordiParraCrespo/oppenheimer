import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a host stops being one — unpaired by its owner, or reported
 * gone by its own uninstall.
 *
 * The relay listens so a link that is open at that moment is closed with the
 * terminal code rather than left up until its next heartbeat; the heartbeat
 * check is what still catches a link held by another API instance.
 */
export class HostUnpairedDomainEvent extends DomainEvent {
  readonly ownerUserId: string;
  /**
   * The owner also asked for the machine to be cleaned up: every session closed,
   * its worktrees removed, nothing pushed. Only a removal from the console asks.
   */
  readonly wipe: boolean;

  constructor(props: DomainEventProps<HostUnpairedDomainEvent>) {
    super(props);
    this.ownerUserId = props.ownerUserId;
    this.wipe = props.wipe;
  }
}
