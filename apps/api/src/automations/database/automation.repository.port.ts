import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { AutomationEntity } from '../domain/automation.entity';
import type { AutomationTriggerProps } from '../domain/automation.types';
import type { WorkspaceLimits } from '../domain/automation-limits.policy';
import type { AutomationRunEntity } from '../domain/automation-run.entity';

/** A trigger that matched an event, with the automation it belongs to. */
export interface TriggerCandidate {
  automation: AutomationEntity;
  trigger: AutomationTriggerProps;
}

/**
 * What the scheduler decides for one due trigger, inside the claim: the run it
 * owes (or none), and when the trigger fires next.
 */
export interface DueScheduleDecision {
  run: AutomationRunEntity | null;
  nextFireAt: Date | null;
}

/** What a due trigger is weighed against, read inside the claim's transaction. */
export interface FiringContext {
  /** The workspace's saved limits (null columns inherit the platform's). */
  workspace: WorkspaceLimits;
  /** Pending and dispatched runs in the last hour, this batch's included. */
  recent: { automation: number; workspace: number };
}

export interface AutomationRepositoryPort {
  /** The automation, its first revision and its triggers, in one transaction. */
  insert(entity: AutomationEntity): Promise<void>;

  /**
   * Write an edit: the row, a new revision when the change made one, and the
   * trigger set. Refused as `conflict` when the stored version is not the one
   * the caller loaded — somebody else saved in between.
   */
  save(entity: AutomationEntity, expectedVersion: number): Promise<'saved' | 'conflict'>;

  /** Live automations the caller can reach, oldest first (the sidebar's order). */
  findAll(scope: AccessScope, filters: { projectId?: string }): Promise<AutomationEntity[]>;

  /** `None` for a missing, deleted or out-of-scope automation. */
  findOneById(scope: AccessScope, id: string): Promise<Option<AutomationEntity>>;

  /** Unscoped, deleted included: the dispatcher and the scheduler, acting for the owner. */
  findOneByIdForSystem(id: string): Promise<Option<AutomationEntity>>;

  /** Live automations whose triggers watch this subject for this event type. */
  findEventCandidates(
    organizationId: string,
    source: string,
    eventType: string,
    subjectRef: string,
  ): Promise<TriggerCandidate[]>;

  /**
   * Claim due schedule triggers (`FOR NO KEY UPDATE SKIP LOCKED`, so replicas
   * take disjoint rows), take their workspaces' firing locks, read their
   * limits and the rate window's counts since `since`, ask `decide` what each
   * owes, then write the run it owes and the trigger's next slot — all in one
   * transaction, on its one connection. The counts include the runs this batch
   * queued before, so a batch cannot fire past a cap. Returns the runs that
   * were queued. Their dispatches carry `correlationId`, the tick's command's.
   */
  fireDueSchedules(
    now: Date,
    batch: number,
    since: Date,
    decide: (
      candidate: TriggerCandidate,
      scheduledFor: Date,
      context: FiringContext,
    ) => DueScheduleDecision,
    correlationId: string,
  ): Promise<AutomationRunEntity[]>;

  /** Live automations that run on a host, unscoped: the host's own lifecycle is asking. */
  findLiveOnHostForSystem(hostId: string): Promise<AutomationEntity[]>;

  /** Live automations in a workspace's project, unscoped. */
  findLiveInProjectForSystem(
    organizationId: string,
    projectId: string,
  ): Promise<AutomationEntity[]>;

  /** Write a system change (pause) without a caller's version. */
  saveForSystem(entity: AutomationEntity): Promise<void>;

  /** Account erasure: every automation of a workspace, with its runs. */
  eraseWorkspace(organizationId: string): Promise<void>;
}
