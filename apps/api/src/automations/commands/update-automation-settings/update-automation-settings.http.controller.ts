import { Body, Controller, Patch, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
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
import { FindAutomationSettingsQuery } from '../../queries/find-automation-settings/find-automation-settings.query';
import { UpdateAutomationSettingsCommand } from './update-automation-settings.command';
import { UpdateAutomationSettingsRequest } from './update-automation-settings.request.dto';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automation-settings')
export class UpdateAutomationSettingsHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Patch()
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    operationId: 'updateAutomationSettings',
    summary: 'Set the workspace’s automation limits',
    description:
      'Rate caps, runs at once per host, overlap, the stale TTL, the missed-slot grace and the longest run. Null clears a value back to the platform default; the platform ceilings still apply.',
  })
  @ApiResponse({ status: 200, type: AutomationSettingsResponseDto })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: UpdateAutomationSettingsRequest,
  ): Promise<AutomationSettingsResponseDto> {
    await this.commandBus.execute<UpdateAutomationSettingsCommand, string>(
      new UpdateAutomationSettingsCommand({ scope, input: body }),
    );
    return this.queryBus.execute<FindAutomationSettingsQuery, AutomationLimits>(
      new FindAutomationSettingsQuery({ scope }),
    );
  }
}
