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
import { GithubTokenResponseDto } from '../../dtos/github-token.response.dto';
import { FindGithubTokensQuery } from './find-github-tokens.query';

@ApiTags('GitHub tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@GithubTokenProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('github/tokens')
export class FindGithubTokensHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'PullRequest' })
  @RequireScopes('pulls:read')
  @ApiOperation({
    summary: 'Your own GitHub tokens',
    description:
      'The tokens you added for repositories the GitHub App is not installed on, oldest first, with what each opens. A token’s secret is never answered.',
  })
  @ApiResponse({ status: 200, type: [GithubTokenResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<GithubTokenResponseDto[]> {
    return this.queryBus.execute(new FindGithubTokensQuery({ userId: scope.userId }));
  }
}
