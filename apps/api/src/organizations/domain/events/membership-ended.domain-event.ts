import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * A person is no longer a member of an organization: removed by an
 * administrator, or they left. `aggregateId` is the organization.
 *
 * Staged on the transactional outbox by `OrganizationAccessRepository.revokeFor`,
 * in the same transaction that takes their roles, grants and session selection
 * there, so what other modules owe the end of a membership (the api-tokens
 * module revokes the tokens pinned to the organization) is never lost to a
 * crash between the two. Delivered at least once: listeners are idempotent.
 */
export class MembershipEndedDomainEvent extends DomainEvent {
  /** The account whose membership ended. */
  readonly userId: string;

  constructor(props: DomainEventProps<MembershipEndedDomainEvent>) {
    super(props);
    this.userId = props.userId;
  }
}
