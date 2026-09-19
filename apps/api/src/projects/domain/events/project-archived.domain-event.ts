import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a project is archived.
 *
 * Carries the slug as well as the tenant because the slug is the retired
 * directory name: a listener that reports on, or cleans up after, a project is
 * interested in the name on disk, and re-reading the row would not tell it the
 * name was retired.
 */
export class ProjectArchivedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly slug: string;

  constructor(props: DomainEventProps<ProjectArchivedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.slug = props.slug;
  }
}
