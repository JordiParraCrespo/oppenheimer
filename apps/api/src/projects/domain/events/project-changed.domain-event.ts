import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a project is made or its settings change (name, repositories,
 * defaults), by a person or a bot acting for one: the console re-reads its
 * projects, so the sidebar shows a project a bot made from chat without a
 * reload. Archiving raises `ProjectArchivedDomainEvent` instead.
 */
export class ProjectChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;

  constructor(props: DomainEventProps<ProjectChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
  }
}
