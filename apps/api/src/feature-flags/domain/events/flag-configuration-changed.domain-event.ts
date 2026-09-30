import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

export type FlagChangeSubject = 'flag' | 'segment';

export type FlagChangeAction =
  | 'targeting_updated'
  | 'toggled'
  | 'segment_created'
  | 'segment_updated'
  | 'segment_deleted';

/**
 * Raised whenever a flag's targeting or a segment changes. One event for both because
 * its consumers do not care which: the audit trail records the diff, and every
 * replica's snapshot is rebuilt either way. Staged on the outbox with the write, so a
 * committed change is an audited one. `before` and `after` are plain JSON: the relay
 * delivers the payload, not the class, and the audit row stores it as it arrives.
 */
export class FlagConfigurationChangedDomainEvent extends DomainEvent {
  readonly subjectType: FlagChangeSubject;
  readonly subjectKey: string;
  readonly action: FlagChangeAction;
  readonly actorId: string | null;
  readonly comment: string | null;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;

  constructor(props: DomainEventProps<FlagConfigurationChangedDomainEvent>) {
    super(props);
    this.subjectType = props.subjectType;
    this.subjectKey = props.subjectKey;
    this.action = props.action;
    this.actorId = props.actorId;
    this.comment = props.comment;
    this.before = props.before;
    this.after = props.after;
  }
}
