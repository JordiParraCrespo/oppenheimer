import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AutomationMapper } from '../../automation.mapper';
import type { AutomationDetail } from '../../domain/automation-read.types';
import { AutomationResponseDto } from '../../dtos/automation.response.dto';
import { FindAutomationQuery } from '../../queries/find-automation/find-automation.query';
import { CreateAutomationCommand } from './create-automation.command';
import { CreateAutomationRequest } from './create-automation.request.dto';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automations')
export class CreateAutomationHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    summary: 'Create an automation',
    description:
      'A saved prompt, where it runs and the triggers that start it. The caller becomes its owner: every run acts as them. It starts listening as soon as it is saved.',
  })
  @ApiResponse({ status: 201, type: AutomationResponseDto })
  @ApiProblemResponse({
    status: 429,
    description: "GitHub's rate limit was reached; try again after Retry-After",
    code: 'GITHUB_015',
  })
  @ApiProblemResponse({
    status: 422,
    description: 'That project cannot hold automations',
    code: 'AUTOMATIONS_007',
  })
  @ApiProblemResponse({
    status: 422,
    description: 'That agent cannot run an automation',
    code: 'AUTOMATIONS_005',
  })
  @ApiProblemResponse({
    status: 422,
    description: 'A trigger would never fire',
    code: 'AUTOMATIONS_006',
  })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: CreateAutomationRequest,
  ): Promise<AutomationResponseDto> {
    const automationId = await this.commandBus.execute<CreateAutomationCommand, string>(
      new CreateAutomationCommand({ scope, input: body }),
    );
    const detail = await this.queryBus.execute<FindAutomationQuery, AutomationDetail>(
      new FindAutomationQuery({ scope, automationId }),
    );
    return this.mapper.toResponse(detail.automation, scope.userId, detail.digest);
  }
}
