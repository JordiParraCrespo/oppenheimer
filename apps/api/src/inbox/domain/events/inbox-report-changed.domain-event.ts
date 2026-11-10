import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a report is sent to a workspace's Inbox and when it is answered
 * there. The workspace's consoles re-read their reports (`inboxReport.changed`).
 */
export class InboxReportChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly reportId: string;

  constructor(props: DomainEventProps<InboxReportChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.reportId = props.reportId;
  }
}
