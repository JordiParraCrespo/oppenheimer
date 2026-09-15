import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a role is deleted. Assignments in the `user_role` join are
 * removed by the database cascade; consumers may react for cache invalidation
 * or auditing.
 */
export class RoleDeletedDomainEvent extends DomainEvent {
  readonly name: string;

  constructor(props: DomainEventProps<RoleDeletedDomainEvent>) {
    super(props);
    this.name = props.name;
  }
}
