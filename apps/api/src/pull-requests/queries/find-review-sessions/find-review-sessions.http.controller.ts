import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { PullRequestProblemResponses } from '../../decorators/pull-request-problem-responses.decorator';
import { ReviewSessionDto } from '../../dtos/review-session.response.dto';
import { FindReviewSessionsQuery } from './find-review-sessions.query';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class FindReviewSessionsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('review-sessions')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'PullRequest' })
  @RequireScopes('pulls:read')
  @ApiOperation({
    summary: 'The caller’s review sessions',
    description:
      'The 100 newest review sessions the caller started and has not closed, with the pull request each one reviews: the Pull requests sidebar’s For review list and each pull request’s Chat tab.',
  })
  @ApiResponse({ status: 200, type: [ReviewSessionDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<ReviewSessionDto[]> {
    return this.queryBus.execute(new FindReviewSessionsQuery({ scope }));
  }
}
