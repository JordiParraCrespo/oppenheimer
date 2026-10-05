import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/** Raised when a token is revoked, so the session cached for it can be dropped. */
export class ApiTokenRevokedDomainEvent extends DomainEvent {
  readonly userId: string;
  readonly tokenHash: string;

  constructor(props: DomainEventProps<ApiTokenRevokedDomainEvent>) {
    super(props);
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
  }
}
