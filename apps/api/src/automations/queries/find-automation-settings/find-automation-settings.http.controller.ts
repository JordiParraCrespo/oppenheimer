import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { AutomationLimits } from '../../domain/automation-limits.policy';
import { AutomationSettingsResponseDto } from '../../dtos/automation-run.response.dto';
import { FindAutomationSettingsQuery } from './find-automation-settings.query';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automation-settings')
export class FindAutomationSettingsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Automation' })
  @RequireScopes('automations:read')
  @ApiOperation({
    operationId: 'getAutomationSettings',
    summary: 'The workspace’s automation limits',
    description:
      'Effective values: the workspace’s own where set, the platform’s defaults elsewhere, under the platform ceilings.',
  })
  @ApiResponse({ status: 200, type: AutomationSettingsResponseDto })
  find(@CurrentAccessScope() scope: AccessScope): Promise<AutomationLimits> {
    return this.queryBus.execute<FindAutomationSettingsQuery, AutomationLimits>(
      new FindAutomationSettingsQuery({ scope }),
    );
  }
}
