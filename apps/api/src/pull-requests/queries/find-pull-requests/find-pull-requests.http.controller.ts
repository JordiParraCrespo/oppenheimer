import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { PULL_REQUEST_SCOPES } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { PullRequestProblemResponses } from '../../decorators/pull-request-problem-responses.decorator';
import { PullRequestQueueResponseDto } from '../../dtos/pull-request.response.dto';
import { FindPullRequestsQuery } from './find-pull-requests.query';
import { FindPullRequestsRequest } from './find-pull-requests.request.dto';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class FindPullRequestsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'PullRequest' })
  @RequireScopes('pulls:read')
  @ApiOperation({
    summary: 'The pull request queue',
    description:
      'Open pull requests of the watched repositories, read live through the workspace’s installations: yours and your sessions’ (`mine`), review requests (`requested`) or the rest (`watching`), longest wait first, each with its lane and what holds it.',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: PULL_REQUEST_SCOPES,
    description: 'Whose queue; default `mine`',
  })
  @ApiResponse({ status: 200, type: PullRequestQueueResponseDto })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindPullRequestsRequest,
  ): Promise<PullRequestQueueResponseDto> {
    return this.queryBus.execute(new FindPullRequestsQuery({ scope, queue: query.scope }));
  }
}
