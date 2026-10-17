import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { PlanWriteKind } from '../plan-change.types';

/**
 * A task's row was written: created, changed or deleted, by a person or an
 * agent. It carries its workspace, so a delete is still routed once the row is
 * gone; the console re-reads the board on it.
 */
export class TaskChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly change: PlanWriteKind;

  constructor(props: DomainEventProps<TaskChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.change = props.change;
  }
}
