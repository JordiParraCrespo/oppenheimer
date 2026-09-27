import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
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
import type { RunHistory } from '../../domain/automation-read.types';
import { RunHistoryResponseDto } from '../../dtos/automation-run.response.dto';
import { FindRunHistoryQuery } from './find-run-history.query';
import { FindRunHistoryRequest } from './find-run-history.request.dto';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automation-runs')
export class FindRunHistoryHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('history')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Automation' })
  @RequireScopes('automations:read')
  @ApiOperation({
    operationId: 'getAutomationRunHistory',
    summary: 'Run history by day',
    description:
      'One bucket per local day of the given zone, today last: runs that did not fail (running ones included) and runs that failed, under the same facets as the runs list.',
  })
  @ApiResponse({ status: 200, type: RunHistoryResponseDto })
  async history(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindRunHistoryRequest,
  ): Promise<RunHistoryResponseDto> {
    const history = await this.queryBus.execute<FindRunHistoryQuery, RunHistory>(
      new FindRunHistoryQuery({ scope, filters: query }),
    );
    const succeeded = history.days.reduce((sum, day) => sum + day.succeeded, 0);
    const failed = history.days.reduce((sum, day) => sum + day.failed, 0);
    return { ...history, succeeded, failed, total: succeeded + failed };
  }
}
