import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { MilestoneEntity } from '../domain/milestone.entity';
import type { MilestoneProgress } from '../milestone.mapper';

export interface MilestoneWithProgress {
  milestone: MilestoneEntity;
  progress: MilestoneProgress;
}

/** Reads take an {@link AccessScope}; writes take a milestone the caller already read through one. */
export interface MilestoneRepositoryPort {
  /** The milestones of one project, or of the workspace, oldest first, with their progress. */
  findAll(scope: AccessScope, filter: { projectId?: string }): Promise<MilestoneWithProgress[]>;
  findOneById(scope: AccessScope, id: string): Promise<Option<MilestoneEntity>>;
  progressOf(milestone: MilestoneEntity): Promise<MilestoneProgress>;
  insert(milestone: MilestoneEntity): Promise<void>;
  /**
   * Write the name, target date and project. A new project carries the milestone's tasks
   * with it in the same statement, through their milestone key's `ON UPDATE CASCADE`.
   */
  save(milestone: MilestoneEntity): Promise<void>;
  /** Delete the milestone. Its tasks stay, with no milestone. */
  delete(milestone: MilestoneEntity): Promise<void>;
}
