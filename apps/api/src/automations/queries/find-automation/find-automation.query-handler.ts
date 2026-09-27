import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { RUN_HISTORY_DAYS } from '@oppenheimer/shared/automations';
import { AUTOMATION_REPOSITORY, AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { AutomationDetail } from '../../domain/automation-read.types';
import { AutomationErrors } from '../../domain/automations.errors';
import { FindAutomationQuery } from './find-automation.query';

@QueryHandler(FindAutomationQuery)
export class FindAutomationQueryHandler
  implements IQueryHandler<FindAutomationQuery, AutomationDetail>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
  ) {}

  async execute(query: FindAutomationQuery): Promise<AutomationDetail> {
    const found = await this.automations.findOneById(query.scope, query.automationId);
    if (found.isNone()) throw new AppError(AutomationErrors.NOT_FOUND);
    const automation = found.unwrap();
    const digests = await this.runs.digests(
      query.scope,
      [automation.id],
      new Date(Date.now() - RUN_HISTORY_DAYS * 86_400_000),
    );
    return { automation, digest: digests.get(automation.id) };
  }
}
