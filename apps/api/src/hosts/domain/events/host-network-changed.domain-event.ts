import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/** What the notice says about a network: never its row id. */
export interface NetworkSummary {
  ip: string;
  countryCode: string | null;
  city: string | null;
  asn: number | null;
  asnOrg: string | null;
}

/**
 * Raised when a host connects from another country or another network
 * operator than before (`networkMoveIsNotable`). The owner is emailed, the way
 * a pairing is: they are the only one who can tell their own move from a key
 * used somewhere else.
 */
export class HostNetworkChangedDomainEvent extends DomainEvent {
  readonly ownerUserId: string;
  readonly hostName: string;
  readonly from: NetworkSummary;
  readonly to: NetworkSummary;

  constructor(props: DomainEventProps<HostNetworkChangedDomainEvent>) {
    super(props);
    this.ownerUserId = props.ownerUserId;
    this.hostName = props.hostName;
    this.from = props.from;
    this.to = props.to;
  }
}
