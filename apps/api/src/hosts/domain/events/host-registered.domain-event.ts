import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a machine finishes pairing and becomes a host.
 *
 * Carries the owner so a listener can decide who to tell without re-reading the
 * row, the fingerprint because that is the identity everything downstream
 * recognises the machine by, and what the machine looked like when it paired,
 * so the notice that describes it needs no read of the host table either.
 */
export class HostRegisteredDomainEvent extends DomainEvent {
  readonly ownerUserId: string;
  readonly publicKeyFingerprint: string;
  readonly pairingTokenId: string;
  /** The name the host was given. */
  readonly name: string;
  /** The hostname and platform the runner reported, when it reported them. */
  readonly hostname: string | null;
  readonly os: string | null;

  constructor(props: DomainEventProps<HostRegisteredDomainEvent>) {
    super(props);
    this.ownerUserId = props.ownerUserId;
    this.publicKeyFingerprint = props.publicKeyFingerprint;
    this.pairingTokenId = props.pairingTokenId;
    this.name = props.name;
    this.hostname = props.hostname;
    this.os = props.os;
  }
}
