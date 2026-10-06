import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { ProjectLookupPort } from '../../projects/application/project-lookup.port';
import { PROJECT_LOOKUP } from '../../projects/projects.di-tokens';
import type { GoalRepositoryPort } from '../database/goal.repository.port';
import type { GoalEntity } from '../domain/goal.entity';
import { TaskErrors } from '../domain/tasks.errors';
import { GOAL_REPOSITORY } from '../tasks.di-tokens';

/** Where a task is filed: always a project, and maybe one of its goals. */
export interface TaskFiling {
  projectId: string;
  goalId: string | null;
}

/** What a request asked for; absent keeps what the task has, if it has anything. */
export interface TaskFilingRequest {
  projectId?: string;
  goalId?: string | null;
}

/**
 * Turns a request's project and goal into where the task is filed, by the rules of
 * `product/versions/mvp/18-plan-product.md` §3: a goal brings its own project, a
 * project change drops a goal of another project, and no project is the workspace's
 * Unassigned one. A project must be active to take a task.
 */
@Injectable()
export class TaskFilingResolver {
  constructor(
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
    @Inject(GOAL_REPOSITORY)
    private readonly goals: GoalRepositoryPort,
  ) {}

  async resolve(
    scope: AccessScope,
    request: TaskFilingRequest,
    current?: TaskFiling,
  ): Promise<TaskFiling> {
    if (request.goalId) {
      const goal = await this.goal(scope, request.goalId);
      if (request.projectId && request.projectId !== goal.projectId) {
        throw new AppError(TaskErrors.GOAL_PROJECT_MISMATCH, {
          detail: `Goal ${goal.id} belongs to project ${goal.projectId}`,
        });
      }
      return { projectId: await this.activeProject(scope, goal.projectId), goalId: goal.id };
    }

    const projectId =
      request.projectId !== undefined
        ? await this.activeProject(scope, request.projectId)
        : (current?.projectId ?? (await this.projects.unassigned(scope)).id);
    // A goal is kept only while it is still of the task's project.
    const keepsGoal =
      request.goalId === undefined && current?.goalId && current.projectId === projectId;
    return { projectId, goalId: keepsGoal ? (current?.goalId ?? null) : null };
  }

  /** A project the caller can file into: present, in the workspace and not archived. */
  async activeProject(scope: AccessScope, projectId: string): Promise<string> {
    const project = await this.projects.findOneById(scope, projectId);
    return requireFound(project, TaskErrors.PROJECT_UNAVAILABLE, {
      detail: `Project ${projectId} is missing or archived`,
    }).id;
  }

  private async goal(scope: AccessScope, goalId: string): Promise<GoalEntity> {
    return requireFound(await this.goals.findOneById(scope, goalId), TaskErrors.GOAL_NOT_FOUND, {
      detail: `No goal with id ${goalId}`,
    });
  }
}
