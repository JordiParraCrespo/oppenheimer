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
import { PullRequestProblemResponses } from '../../decorators/pull-request-problem-responses.decorator';
import { WatchedRepositoryDto } from '../../dtos/pull-request.response.dto';
import { FindWatchedRepositoriesQuery } from './find-watched-repositories.query';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class FindWatchedRepositoriesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('repositories')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'PullRequest' })
  @RequireScopes('pulls:read')
  @ApiOperation({
    summary: 'The repositories the queue can watch',
    description:
      'Every repository the workspace’s installations cover, and whether the caller watches it. Watched unless they switched it off.',
  })
  @ApiResponse({ status: 200, type: [WatchedRepositoryDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<WatchedRepositoryDto[]> {
    return this.queryBus.execute(new FindWatchedRepositoriesQuery({ scope }));
  }
}
