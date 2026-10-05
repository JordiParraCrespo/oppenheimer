import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RUN_WINDOW_DAYS } from '@oppenheimer/shared/automations';
import { AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { RunPage } from '../../domain/automation-read.types';
import { FindAutomationRunsQuery } from './find-automation-runs.query';

/**
 * The Runs tab, and one automation's runs: a page (ten by default), newest first,
 * with the total for "1–10 of 65" and the per-tab counts under the same facets.
 */
@QueryHandler(FindAutomationRunsQuery)
export class FindAutomationRunsQueryHandler
  implements IQueryHandler<FindAutomationRunsQuery, RunPage>
{
  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
  ) {}

  execute(query: FindAutomationRunsQuery): Promise<RunPage> {
    const { filters } = query;
    return this.runs.page(
      query.scope,
      {
        automationId: filters.automationId,
        projectId: filters.projectId,
        statuses: filters.status,
        since: new Date(Date.now() - RUN_WINDOW_DAYS[filters.window] * 86_400_000),
      },
      filters.page,
      filters.limit,
    );
  }
}
