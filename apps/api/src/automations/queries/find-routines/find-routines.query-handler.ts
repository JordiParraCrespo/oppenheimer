import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RUN_HISTORY_DAYS } from '@oppenheimer/shared/automations';
import {
  AUTOMATION_REPOSITORY,
  AUTOMATION_RUN_REPOSITORY,
  AUTOMATION_WEBHOOK_REPOSITORY,
} from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { AutomationWebhookRepositoryPort } from '../../database/automation-webhook.repository.port';
import type { AutomationListing } from '../../domain/automation-read.types';
import { FindRoutinesQuery } from './find-routines.query';

/** The workspace's live bot routines, oldest first, each with its run digest. */
@QueryHandler(FindRoutinesQuery)
export class FindRoutinesQueryHandler
  implements IQueryHandler<FindRoutinesQuery, AutomationListing>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    @Inject(AUTOMATION_WEBHOOK_REPOSITORY)
    private readonly webhooks: AutomationWebhookRepositoryPort,
  ) {}

  async execute(query: FindRoutinesQuery): Promise<AutomationListing> {
    const automations = await this.automations.findRoutines(query.scope);
    const since = new Date(Date.now() - RUN_HISTORY_DAYS * 86_400_000);
    const ids = automations.map((automation) => automation.id);
    const [digests, webhooks] = await Promise.all([
      this.runs.digests(query.scope, ids, since),
      query.scope.organizationId
        ? this.webhooks.findViews(query.scope.organizationId, ids)
        : new Map(),
    ]);
    return { automations, digests, webhooks };
  }
}
