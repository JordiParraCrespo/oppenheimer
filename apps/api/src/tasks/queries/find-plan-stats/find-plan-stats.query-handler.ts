import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { planStatsWeeks, previousPlanStatsPeriod } from '@oppenheimer/shared';
import { requireTenant } from '../../../authz/application/tenant-scope.policy';
import type { SessionUsageReader } from '../../../sessions/database/session-usage.repository.port';
import { SESSION_USAGE_READER } from '../../../sessions/sessions.di-tokens';
import type {
  PlanEventRangeInput,
  PlanEventRepositoryPort,
} from '../../database/plan-event.repository.port';
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
    @Inject(SESSION_USAGE_READER)
    private readonly sessionUsage: SessionUsageReader,
    private readonly mapper: PlanStatsMapper,
  ) {}

  async execute({ scope, period }: FindPlanStatsQuery): Promise<PlanStatsResponseDto> {
    requireTenant(scope);
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

  /** Tokens and cost reported by the turns that ended in the range (headless ones report them). */
  private async usage(range: PlanEventRangeInput): Promise<PlanUsageWeek[]> {
    const weeks = await this.sessionUsage.weeklyUsage(range);
    return weeks.filter((week) => week.inputTokens + week.outputTokens > 0 || week.costUsd > 0);
  }
}
