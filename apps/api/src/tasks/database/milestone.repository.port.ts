import type { Option } from 'oxide.ts';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { MilestoneEntity } from '../domain/milestone.entity';
import type { MilestoneProgress } from '../milestone.mapper';

export interface MilestoneWithProgress {
  milestone: MilestoneEntity;
  progress: MilestoneProgress;
}

/** A create answered by the milestone an earlier request with the same idempotency key made. */
export type MilestoneInsertOutcome = 'inserted' | { existingId: string };

/** `version-conflict` when the writer named a version the row no longer holds; nothing changed. */
export type MilestoneWriteOutcome = 'saved' | 'version-conflict';

/**
 * Reads take an {@link AccessScope}; writes take a milestone the caller already
 * read through one. Every write bumps the version, logs the milestone's changes
 * to `plan_event` and stages its events, in one transaction.
 */
export interface MilestoneRepositoryPort {
  /** The milestones of one project, or of the workspace, oldest first, with their progress. */
  findAll(scope: AccessScope, filter: { projectId?: string }): Promise<MilestoneWithProgress[]>;
  findOneById(scope: AccessScope, id: string): Promise<Option<MilestoneEntity>>;
  progressOf(milestone: MilestoneEntity): Promise<MilestoneProgress>;
  insert(milestone: MilestoneEntity): Promise<MilestoneInsertOutcome>;
  /**
   * Write the name, target date and project. A new project carries the milestone's tasks
   * with it in the same statement, through their milestone key's `ON UPDATE CASCADE`.
   */
  save(milestone: MilestoneEntity): Promise<MilestoneWriteOutcome>;
  /** Delete the milestone. Its tasks stay, with no milestone. */
  delete(milestone: MilestoneEntity): Promise<MilestoneWriteOutcome>;
}
