import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { AutomationRunOutcome, AutomationSkipReason } from '@oppenheimer/shared/automations';

/**
 * Raised when a run is written in a new outcome: queued, skipped, expired,
 * deferred or dispatched. Running and finished are its session's to say.
 */
export class AutomationRunChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly automationId: string;
  /** What the run became: a skipped or expired one never ran. */
  readonly outcome: AutomationRunOutcome;
  readonly skipReason: AutomationSkipReason | null;

  constructor(props: DomainEventProps<AutomationRunChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.automationId = props.automationId;
    this.outcome = props.outcome;
    this.skipReason = props.skipReason;
  }
}
