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
import { PullRequestProblemResponses } from '../../decorators/pull-request-problem-responses.decorator';
import { PullRequestAnalyticsResponseDto } from '../../dtos/pull-request-analytics.response.dto';
import { FindPullRequestAnalyticsQuery } from './find-pull-request-analytics.query';
import { FindPullRequestAnalyticsRequest } from './find-pull-request-analytics.request.dto';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class FindPullRequestAnalyticsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('analytics')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'PullRequest' })
  @RequireScopes('pulls:read')
  @ApiOperation({
    summary: 'Pull request analytics',
    description:
      'The watched repositories over a week, a month or a quarter against the period before: created and merged per day, what you reviewed, median waits for review (sessions and people apart) and to merge, the lane mix, and what holds the open pull requests now.',
  })
  @ApiResponse({ status: 200, type: PullRequestAnalyticsResponseDto })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindPullRequestAnalyticsRequest,
  ): Promise<PullRequestAnalyticsResponseDto> {
    return this.queryBus.execute(new FindPullRequestAnalyticsQuery({ scope, range: query.range }));
  }
}
