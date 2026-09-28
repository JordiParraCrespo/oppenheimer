import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { RunHistory } from '../../domain/automation-read.types';
import { fillHistory, historyWindow } from '../../domain/run-history.policy';
import { FindRunHistoryQuery } from './find-run-history.query';

/**
 * The run-history chart: every local day of the window with its succeeded and
 * failed runs. Counts the same runs the Runs tab lists under the same facets,
 * without the status filter — the chart is what the tabs split.
 */
@QueryHandler(FindRunHistoryQuery)
export class FindRunHistoryQueryHandler implements IQueryHandler<FindRunHistoryQuery, RunHistory> {
  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
  ) {}

  async execute(query: FindRunHistoryQuery): Promise<RunHistory> {
    const { filters } = query;
    const window = historyWindow(new Date(), filters.days, filters.timezone);
    const buckets = await this.runs.history(
      query.scope,
      { automationId: filters.automationId, projectId: filters.projectId, since: window.since },
      filters.timezone,
    );
    return { days: fillHistory(window, buckets), timezone: filters.timezone };
  }
}
