import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RUN_HISTORY_DAYS } from '@oppenheimer/shared/automations';
import { AUTOMATION_REPOSITORY, AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { AutomationListing } from '../../domain/automation-read.types';
import { FindAutomationsQuery } from './find-automations.query';

/**
 * The sidebar and the table: every live automation with what its runs say —
 * whether one is running, how many ran in the window, and the last six. The
 * same few queries for the whole list, whatever its length.
 */
@QueryHandler(FindAutomationsQuery)
export class FindAutomationsQueryHandler
  implements IQueryHandler<FindAutomationsQuery, AutomationListing>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
  ) {}

  async execute(query: FindAutomationsQuery): Promise<AutomationListing> {
    const automations = await this.automations.findAll(query.scope, { projectId: query.projectId });
    const since = new Date(Date.now() - RUN_HISTORY_DAYS * 86_400_000);
    const digests = await this.runs.digests(
      query.scope,
      automations.map((automation) => automation.id),
      since,
    );
    return { automations, digests };
  }
}
