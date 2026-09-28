import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { AutomationLimitsResolver } from '../../application/automation-limits.resolver';
import type { AutomationLimits } from '../../domain/automation-limits.policy';
import { AutomationErrors } from '../../domain/automations.errors';
import { FindAutomationSettingsQuery } from './find-automation-settings.query';

/** The workspace's effective limits: what its automations get when they set nothing. */
@QueryHandler(FindAutomationSettingsQuery)
export class FindAutomationSettingsQueryHandler
  implements IQueryHandler<FindAutomationSettingsQuery, AutomationLimits>
{
  constructor(private readonly limits: AutomationLimitsResolver) {}

  execute(query: FindAutomationSettingsQuery): Promise<AutomationLimits> {
    if (!query.scope.organizationId) throw new AppError(AutomationErrors.NO_ACTIVE_ORGANIZATION);
    return this.limits.resolve(query.scope.organizationId);
  }
}
