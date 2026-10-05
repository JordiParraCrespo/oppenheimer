import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { GoalEntity } from '../domain/goal.entity';
import type { GoalProgress } from '../goal.mapper';

export interface GoalWithProgress {
  goal: GoalEntity;
  progress: GoalProgress;
}

/** Reads take an {@link AccessScope}; writes take a goal the caller already read through one. */
export interface GoalRepositoryPort {
  /** The goals of one project, or of the workspace, oldest first, with their progress. */
  findAll(scope: AccessScope, filter: { projectId?: string }): Promise<GoalWithProgress[]>;
  findOneById(scope: AccessScope, id: string): Promise<Option<GoalEntity>>;
  progressOf(goal: GoalEntity): Promise<GoalProgress>;
  insert(goal: GoalEntity): Promise<void>;
  /**
   * Write the name, target date and project. A new project carries the goal's tasks
   * with it in the same statement, through their goal key's `ON UPDATE CASCADE`.
   */
  save(goal: GoalEntity): Promise<void>;
  /** Delete the goal. Its tasks stay, with no goal. */
  delete(goal: GoalEntity): Promise<void>;
}
