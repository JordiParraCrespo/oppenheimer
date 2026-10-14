import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  PLAN_MILESTONE_EVENT_KINDS,
  PLAN_TASK_EVENT_KINDS,
  type PlanEventKind,
} from '@oppenheimer/shared';
import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One change worth logging on Plan, of a task or a milestone, and who made it
 * (`product/versions/mvp/23-plan-milestones-stats-accounts.md` §4). Append-only:
 * no `updatedAt`, and its subject has no foreign key, so the row outlives what
 * it names. The organization's key cascades it away with the workspace.
 */
@Entity('plan_event')
@Index('IDX_plan_event_occurred', ['organizationId', 'occurredAt'])
@Index('IDX_plan_event_project_occurred', ['organizationId', 'projectId', 'occurredAt'])
@Index('IDX_plan_event_actor_user', ['actorUserId'], { where: '"actorUserId" IS NOT NULL' })
@Check(
  'CHK_plan_event_kind',
  `"kind" IN (${[...PLAN_TASK_EVENT_KINDS, ...PLAN_MILESTONE_EVENT_KINDS].map((kind) => `'${kind}'`).join(', ')})`,
)
@Check(
  'CHK_plan_event_kind_subject',
  `("kind" LIKE 'milestone\\_%') = ("subjectType" = 'milestone')`,
)
@Check('CHK_plan_event_subject_type', `"subjectType" IN ('task', 'milestone')`)
@Check('CHK_plan_event_actor_type', `"actorType" IN ('user', 'agent')`)
@Check('CHK_plan_event_agent', `("actorType" = 'agent') = ("actorAgentId" IS NOT NULL)`)
export class PlanEventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 16 })
  subjectType!: 'task' | 'milestone';

  @Column({ type: 'uuid' })
  subjectId!: string;

  /** The subject's project when it happened. */
  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'uuid', nullable: true })
  milestoneId!: string | null;

  @Column({ type: 'varchar', length: 24 })
  kind!: PlanEventKind;

  @Column({ type: 'varchar', length: 8 })
  actorType!: 'user' | 'agent';

  /** The person, or the person the agent acted for. */
  @Column({ type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorAgentId!: string | null;

  /** The old and new value of the one field the kind names. */
  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, default: () => 'now()' })
  occurredAt!: Date;
}
