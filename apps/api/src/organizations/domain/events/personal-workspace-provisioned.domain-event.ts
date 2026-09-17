import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * A new account was given the organization it works in.
 *
 * Raised by {@link PersonalWorkspaceEntity.provisionFor} and staged on the
 * transactional outbox by the repository, inside the same transaction as the
 * three rows it describes — so nothing can observe a workspace that exists
 * without the event, or an event for a workspace that was rolled back.
 */
export class PersonalWorkspaceProvisionedDomainEvent extends DomainEvent {
  /** The account the workspace belongs to, and its only owner. */
  readonly ownerId: string;

  /** What the workspace is called — the account's name, at the time. */
  readonly name: string;

  readonly slug: string;

  constructor(props: DomainEventProps<PersonalWorkspaceProvisionedDomainEvent>) {
    super(props);
    this.ownerId = props.ownerId;
    this.name = props.name;
    this.slug = props.slug;
  }
}
