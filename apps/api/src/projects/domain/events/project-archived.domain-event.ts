import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a project is retired. Nothing new is listed under it, so what
 * would start work in it — an automation — stops now rather than failing at
 * its next firing.
 */
export class ProjectArchivedDomainEvent extends DomainEvent {
  readonly organizationId: string;

  constructor(props: DomainEventProps<ProjectArchivedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
  }
}
