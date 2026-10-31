import { Inject, Injectable } from '@nestjs/common';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { ProjectLookupPort } from '../../projects/application/project-lookup.port';
import { PROJECT_LOOKUP } from '../../projects/projects.di-tokens';
import type { MilestoneRepositoryPort } from '../database/milestone.repository.port';
import type { MilestoneEntity } from '../domain/milestone.entity';
import { TaskErrors } from '../domain/tasks.errors';
import { MILESTONE_REPOSITORY } from '../tasks.di-tokens';

/** Where a task is filed: always a project, and maybe one of its milestones. */
export interface TaskFiling {
  projectId: string;
  milestoneId: string | null;
}

/** What a request asked for; absent keeps what the task has, if it has anything. */
export interface TaskFilingRequest {
  projectId?: string;
  milestoneId?: string | null;
}

/**
 * Turns a request's project and milestone into where the task is filed, by the rules of
 * `product/versions/mvp/18-plan-product.md` §3: a milestone brings its own project, a
 * project change drops a milestone of another project, and no project is the workspace's
 * Unassigned one. A project must be active to take a task.
 */
@Injectable()
export class TaskFilingResolver {
  constructor(
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
    @Inject(MILESTONE_REPOSITORY)
    private readonly milestones: MilestoneRepositoryPort,
  ) {}

  async resolve(
    scope: AccessScope,
    request: TaskFilingRequest,
    current?: TaskFiling,
  ): Promise<TaskFiling> {
    if (request.milestoneId) {
      const milestone = await this.milestone(scope, request.milestoneId);
      if (request.projectId && request.projectId !== milestone.projectId) {
        throw new AppError(TaskErrors.MILESTONE_PROJECT_MISMATCH, {
          detail: `Milestone ${milestone.id} belongs to project ${milestone.projectId}`,
        });
      }
      return {
        projectId: await this.activeProject(scope, milestone.projectId),
        milestoneId: milestone.id,
      };
    }

    const projectId =
      request.projectId !== undefined
        ? await this.activeProject(scope, request.projectId)
        : (current?.projectId ?? (await this.projects.unassigned(scope)).id);
    // A milestone is kept only while it is still of the task's project.
    const keepsMilestone =
      request.milestoneId === undefined && current?.milestoneId && current.projectId === projectId;
    return { projectId, milestoneId: keepsMilestone ? (current?.milestoneId ?? null) : null };
  }

  /** A project the caller can file into: present, in the workspace and not archived. */
  async activeProject(scope: AccessScope, projectId: string): Promise<string> {
    const project = await this.projects.findOneById(scope, projectId);
    return requireFound(project, TaskErrors.PROJECT_UNAVAILABLE, {
      detail: `Project ${projectId} is missing or archived`,
    }).id;
  }

  private async milestone(scope: AccessScope, milestoneId: string): Promise<MilestoneEntity> {
    return requireFound(
      await this.milestones.findOneById(scope, milestoneId),
      TaskErrors.MILESTONE_NOT_FOUND,
      {
        detail: `No milestone with id ${milestoneId}`,
      },
    );
  }
}
