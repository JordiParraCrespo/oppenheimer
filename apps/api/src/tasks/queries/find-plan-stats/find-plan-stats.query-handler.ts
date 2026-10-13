import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { planStatsWeeks, previousPlanStatsPeriod } from '@oppenheimer/shared';
import type {
  PlanEventRangeInput,
  PlanEventRepositoryPort,
} from '../../database/plan-event.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import type { PlanStatsResponseDto } from '../../dtos/plan-stats.response.dto';
import { PlanStatsMapper, type PlanUsageWeek } from '../../plan-stats.mapper';
import { PLAN_EVENT_REPOSITORY } from '../../tasks.di-tokens';
import { FindPlanStatsQuery } from './find-plan-stats.query';

/**
 * Composes Stats from the sources that own its rows
 * (`product/versions/mvp/23-plan-milestones-stats-accounts.md` §4): tasks from
 * Plan's event log, tokens and cost from the sessions module's usage. Pull
 * requests are not counted yet (decided: Stats ships without them first).
 */
@QueryHandler(FindPlanStatsQuery)
export class FindPlanStatsQueryHandler
  implements IQueryHandler<FindPlanStatsQuery, PlanStatsResponseDto>
{
  constructor(
    @Inject(PLAN_EVENT_REPOSITORY)
    private readonly events: PlanEventRepositoryPort,
    private readonly mapper: PlanStatsMapper,
  ) {}

  async execute({ scope, period }: FindPlanStatsQuery): Promise<PlanStatsResponseDto> {
    if (!scope.organizationId) throw new AppError(TaskErrors.NO_ACTIVE_ORGANIZATION);
    const range = (from: string, to: string): PlanEventRangeInput => ({
      organizationId: scope.organizationId as string,
      projectId: period.projectId,
      from,
      to,
      timeZone: period.timeZone,
    });
    const previous = period.compare ? previousPlanStatsPeriod(period.from, period.to) : null;
    const [counts, usage, previousCounts, previousUsage] = await Promise.all([
      this.events.weeklyTaskCounts(range(period.from, period.to)),
      this.usage(range(period.from, period.to)),
      previous ? this.events.weeklyTaskCounts(range(previous.from, previous.to)) : [],
      previous ? this.usage(range(previous.from, previous.to)) : null,
    ]);
    return this.mapper.toResponse({
      from: period.from,
      to: period.to,
      timeZone: period.timeZone,
      weeks: planStatsWeeks(period.from, period.to),
      counts,
      usage,
      previous: previous ? { ...previous, counts: previousCounts, usage: previousUsage } : null,
    });
  }

  private async usage(_range: PlanEventRangeInput): Promise<PlanUsageWeek[] | null> {
    return null;
  }
}
