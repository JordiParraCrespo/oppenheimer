import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { PlanTaskEventKind, TaskStatus } from '@oppenheimer/shared';
import type { PlanActor } from '../plan-change.types';

/**
 * Plan logged a change to a task: one event per `plan_event` row, staged in
 * the same transaction, for whoever follows the task's project or milestone
 * (bots, `27-bot-subscriptions.md` §7.2). It carries what a follower is told
 * and nothing of the task's notes.
 */
export class TaskActivityLoggedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly kind: PlanTaskEventKind;
  /** Where the task is filed after the change. */
  readonly projectId: string;
  readonly milestoneId: string | null;
  /** Where it was filed before, for a `reassigned`; null otherwise. */
  readonly previous: { projectId: string; milestoneId: string | null } | null;
  readonly title: string;
  readonly from: TaskStatus | null;
  readonly to: TaskStatus | null;
  readonly actor: PlanActor;

  constructor(props: DomainEventProps<TaskActivityLoggedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.kind = props.kind;
    this.projectId = props.projectId;
    this.milestoneId = props.milestoneId;
    this.previous = props.previous;
    this.title = props.title;
    this.from = props.from;
    this.to = props.to;
    this.actor = props.actor;
  }
}
