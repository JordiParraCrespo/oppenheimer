import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { type ProjectPlanSummary, summarizePlan } from '@oppenheimer/shared/plan';
import type { MilestoneRepositoryPort } from '../../database/milestone.repository.port';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import { MilestoneMapper } from '../../milestone.mapper';
import { TaskMapper } from '../../task.mapper';
import { MILESTONE_REPOSITORY, TASK_REPOSITORY } from '../../tasks.di-tokens';
import { FindPlanSummaryQuery } from './find-plan-summary.query';

/** Loads the caller's tasks and milestones and hands them to the shared summary, nothing more. */
@QueryHandler(FindPlanSummaryQuery)
export class FindPlanSummaryQueryHandler
  implements IQueryHandler<FindPlanSummaryQuery, ProjectPlanSummary[]>
{
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
    @Inject(MILESTONE_REPOSITORY)
    private readonly milestones: MilestoneRepositoryPort,
    private readonly taskMapper: TaskMapper,
    private readonly milestoneMapper: MilestoneMapper,
  ) {}

  async execute({ scope, projectId, today }: FindPlanSummaryQuery): Promise<ProjectPlanSummary[]> {
    const [tasks, milestones] = await Promise.all([
      this.tasks.findAll(scope, { projectId }),
      this.milestones.findAll(scope, { projectId }),
    ]);
    return summarizePlan(
      tasks.map((task) => this.taskMapper.toSummaryTask(task)),
      milestones.map(({ milestone }) => this.milestoneMapper.toSummaryMilestone(milestone)),
      today,
    );
  }
}
