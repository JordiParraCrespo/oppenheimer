import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised once per stored event, in the transaction that stored it. Carries what
 * a matcher needs to decide without a read — the type, the subject, the actor
 * and the attributes — and the id to read the untrusted context by when a
 * consumer decides to act. The context itself is not copied onto the outbox.
 */
export class ExternalEventReceivedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly source: string;
  readonly eventType: string;
  readonly subjectKind: string;
  readonly subjectRef: string;
  readonly actorLogin: string | null;
  readonly actorIsOwnApp: boolean;
  readonly attributes: Record<string, unknown>;
  readonly externalId: string;
  readonly occurredAt: string;

  constructor(props: DomainEventProps<ExternalEventReceivedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.source = props.source;
    this.eventType = props.eventType;
    this.subjectKind = props.subjectKind;
    this.subjectRef = props.subjectRef;
    this.actorLogin = props.actorLogin;
    this.actorIsOwnApp = props.actorIsOwnApp;
    this.attributes = props.attributes;
    this.externalId = props.externalId;
    this.occurredAt = props.occurredAt;
  }
}
