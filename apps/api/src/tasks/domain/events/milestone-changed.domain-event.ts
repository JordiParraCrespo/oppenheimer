import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { PlanWriteKind } from '../plan-change.types';

/** A milestone's row was written; like `TaskChangedDomainEvent`, it carries its workspace. */
export class MilestoneChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly change: PlanWriteKind;

  constructor(props: DomainEventProps<MilestoneChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.change = props.change;
  }
}
