import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AutomationRunMapper } from '../../automation-run.mapper';
import type { RunReadModel } from '../../domain/automation-read.types';
import { AutomationRunResponseDto } from '../../dtos/automation-run.response.dto';
import { FindAutomationRunQuery } from './find-automation-run.query';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automation-runs')
export class FindAutomationRunHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationRunMapper,
  ) {}

  @Get(':id')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Automation' })
  @RequireScopes('automations:read')
  @ApiOperation({
    summary: 'Read one automation run',
    description:
      'Why it ran, what the guards decided, the session it started and that session’s turn: the prompt the agent was given, the state, the result and the times.',
  })
  @ApiResponse({ status: 200, type: AutomationRunResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Run not found', code: 'AUTOMATIONS_008' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) runId: string,
  ): Promise<AutomationRunResponseDto> {
    const run = await this.queryBus.execute<FindAutomationRunQuery, RunReadModel>(
      new FindAutomationRunQuery({ scope, runId }),
    );
    return this.mapper.toResponse(run);
  }
}
