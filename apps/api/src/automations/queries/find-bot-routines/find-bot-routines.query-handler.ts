import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RUN_HISTORY_DAYS } from '@oppenheimer/shared/automations';
import { AUTOMATION_REPOSITORY, AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { AutomationListing } from '../../domain/automation-read.types';
import { FindBotRoutinesQuery } from './find-bot-routines.query';

/** A bot's live routines, oldest first, each with its run digest: the shape the console's list reads. */
@QueryHandler(FindBotRoutinesQuery)
export class FindBotRoutinesQueryHandler
  implements IQueryHandler<FindBotRoutinesQuery, AutomationListing>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
  ) {}

  async execute(query: FindBotRoutinesQuery): Promise<AutomationListing> {
    const automations = await this.automations.findAll(query.scope, { botId: query.botId });
    const since = new Date(Date.now() - RUN_HISTORY_DAYS * 86_400_000);
    const digests = await this.runs.digests(
      query.scope,
      automations.map((automation) => automation.id),
      since,
    );
    return { automations, digests };
  }
}
