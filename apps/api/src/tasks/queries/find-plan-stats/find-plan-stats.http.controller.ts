import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { PlanStatsResponseDto } from '../../dtos/plan-stats.response.dto';
import { FindPlanStatsQuery } from './find-plan-stats.query';
import { FindPlanStatsRequest } from './find-plan-stats.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('plan')
export class FindPlanStatsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('stats')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Task' })
  @RequireScopes('tasks:read')
  @ApiOperation({
    summary: 'Plan’s Stats for a period',
    description:
      'Tasks created and completed, tokens per model and agent cost, per week from `from` to `to` (included, at most 371 days) in `timeZone`, for the workspace or one project, and the period of the same length before it unless `compare=false`.',
  })
  @ApiQuery({ name: 'from', required: true, type: String, format: 'date', example: '2026-09-14' })
  @ApiQuery({ name: 'to', required: true, type: String, format: 'date', example: '2026-10-13' })
  @ApiQuery({ name: 'timeZone', required: true, type: String, example: 'Europe/Madrid' })
  @ApiQuery({ name: 'projectId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'compare', required: false, enum: ['true', 'false'] })
  @ApiResponse({ status: 200, type: PlanStatsResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active organization', code: 'TASKS_003' })
  async stats(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindPlanStatsRequest,
  ): Promise<PlanStatsResponseDto> {
    return this.queryBus.execute(new FindPlanStatsQuery({ scope, period: query }));
  }
}
