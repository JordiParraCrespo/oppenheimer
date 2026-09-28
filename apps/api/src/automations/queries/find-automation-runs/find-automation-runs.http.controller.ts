import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { AUTOMATION_RUN_STATUSES, RUN_WINDOWS } from '@oppenheimer/shared/automations';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AutomationRunMapper } from '../../automation-run.mapper';
import type { RunPage } from '../../domain/automation-read.types';
import { AutomationRunPageResponseDto } from '../../dtos/automation-run.response.dto';
import { FindAutomationRunsQuery } from './find-automation-runs.query';
import { FindAutomationRunsRequest } from './find-automation-runs.request.dto';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automation-runs')
export class FindAutomationRunsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationRunMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Automation' })
  @RequireScopes('automations:read')
  @ApiOperation({
    operationId: 'listAutomationRuns',
    summary: 'List automation runs',
    description:
      'The Runs tab, and one automation’s runs: newest first, a page of ten by default, with the total and the count per status tab under the same facets. Runs that never became a session (skipped, expired) are left out unless their status is asked for.',
  })
  @ApiQuery({
    name: 'automationId',
    required: false,
    type: String,
    description: 'One automation’s runs',
  })
  @ApiQuery({ name: 'projectId', required: false, type: String, description: 'One project’s runs' })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: `Comma-separated, any of ${AUTOMATION_RUN_STATUSES.join(', ')}. Default: every status but skipped and expired`,
  })
  @ApiQuery({ name: 'window', required: false, enum: RUN_WINDOWS, description: 'Default `30d`' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'From 1' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Default 10' })
  @ApiResponse({ status: 200, type: AutomationRunPageResponseDto })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindAutomationRunsRequest,
  ): Promise<AutomationRunPageResponseDto> {
    const page = await this.queryBus.execute<FindAutomationRunsQuery, RunPage>(
      new FindAutomationRunsQuery({ scope, filters: query }),
    );
    return {
      items: page.items.map((run) => this.mapper.toResponse(run)),
      total: page.total,
      page: query.page,
      limit: query.limit,
      counts: page.counts,
    };
  }
}
