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
import { GithubTokenProblemResponses } from '../../decorators/github-token-problem-responses.decorator';
import { GithubTokenReadsResponseDto } from '../../dtos/github-token.response.dto';
import { FindGithubTokenReadsQuery } from './find-github-token-reads.query';

@ApiTags('GitHub tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@GithubTokenProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('github/tokens')
export class FindGithubTokenReadsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('repositories')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'PullRequest' })
  @RequireScopes('pulls:read')
  @ApiOperation({
    summary: 'Which of your tokens reads each repository',
    description:
      'Every repository your tokens open, by name, with the token that reads it now: the one you pinned, else the one that opens the fewest repositories. A repository the GitHub App also covers is read through the App instead.',
  })
  @ApiResponse({ status: 200, type: [GithubTokenReadsResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<GithubTokenReadsResponseDto[]> {
    return this.queryBus.execute(new FindGithubTokenReadsQuery({ userId: scope.userId }));
  }
}
