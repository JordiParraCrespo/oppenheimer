import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { RunReadModel } from '../../domain/automation-read.types';
import { AutomationErrors } from '../../domain/automations.errors';
import { FindAutomationRunQuery } from './find-automation-run.query';

@QueryHandler(FindAutomationRunQuery)
export class FindAutomationRunQueryHandler
  implements IQueryHandler<FindAutomationRunQuery, RunReadModel>
{
  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
  ) {}

  async execute(query: FindAutomationRunQuery): Promise<RunReadModel> {
    const found = await this.runs.findOne(query.scope, query.runId);
    return requireFound(found, AutomationErrors.RUN_NOT_FOUND);
  }
}
