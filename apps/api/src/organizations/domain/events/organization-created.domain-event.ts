import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Someone created an organization from the console (`POST /organizations`),
 * as opposed to the personal workspace sign-up provisions, which raises
 * `PersonalWorkspaceProvisionedDomainEvent`.
 *
 * Emitted in process after Better Auth has committed the organization, outside
 * any transaction of ours, so it is best-effort: a listener that fails is
 * logged, and what it would have provisioned is provisioned on first use.
 */
export class OrganizationCreatedDomainEvent extends DomainEvent {
  /** The account that created it, and its first owner. */
  readonly creatorId: string;

  constructor(props: DomainEventProps<OrganizationCreatedDomainEvent>) {
    super(props);
    this.creatorId = props.creatorId;
  }
}
