import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
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
import { addressFrom } from '../../../github/domain/repository-address.policy';
import type { RepositorySource } from '../../../github/domain/repository-address.types';
import { PullRequestProblemResponses } from '../../decorators/pull-request-problem-responses.decorator';
import {
  ApiRepositorySource,
  RepositorySourceParam,
} from '../../decorators/repository-source.decorator';
import { PullRequestBriefResponseDto } from '../../dtos/pull-request-brief.response.dto';
import { FindPullRequestBriefQuery } from './find-pull-request-brief.query';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class FindPullRequestBriefHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':installationId/:githubRepoId/:number/brief')
  @Version('1')
  @ApiRepositorySource()
  @CheckPolicies({ action: 'read', subject: 'PullRequest' })
  @RequireScopes('pulls:read')
  @ApiOperation({
    summary: 'A pull request’s brief',
    description:
      'What the review deck leads a pull request with, for its head commit: one sentence, a few points, where to look first and the description’s pictures. Written by the deployment’s language model and kept per commit; taken from the description when no model is configured or it did not answer.',
  })
  @ApiResponse({ status: 200, type: PullRequestBriefResponseDto })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @RepositorySourceParam() source: RepositorySource,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
    @Param('number', ParseIntPipe) number: number,
  ): Promise<PullRequestBriefResponseDto> {
    return this.queryBus.execute(
      new FindPullRequestBriefQuery({
        scope,
        address: { ...addressFrom(source, githubRepoId), number },
      }),
    );
  }
}
