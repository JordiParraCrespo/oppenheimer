import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
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
    // A bot routine's run has no project and no session; the run page is a
    // session automation's, and a routine's runs are drawn by the bot's chat.
    if (found.isNone() || found.unwrap().projectId === null) {
      throw new AppError(AutomationErrors.RUN_NOT_FOUND);
    }
    return found.unwrap();
  }
}
