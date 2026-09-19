import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a machine finishes pairing and becomes a host.
 *
 * Carries the owner so a listener can decide who to tell without re-reading the
 * row, and the fingerprint because that is the identity everything downstream
 * recognises the machine by.
 */
export class HostRegisteredDomainEvent extends DomainEvent {
  readonly ownerUserId: string;
  readonly publicKeyFingerprint: string;
  readonly pairingTokenId: string;

  constructor(props: DomainEventProps<HostRegisteredDomainEvent>) {
    super(props);
    this.ownerUserId = props.ownerUserId;
    this.publicKeyFingerprint = props.publicKeyFingerprint;
    this.pairingTokenId = props.pairingTokenId;
  }
}
