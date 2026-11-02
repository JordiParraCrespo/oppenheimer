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
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { addressFrom } from '../../../github/domain/repository-address.policy';
import type { RepositorySource } from '../../../github/domain/repository-address.types';
import { PullRequestProblemResponses } from '../../decorators/pull-request-problem-responses.decorator';
import {
  ApiRepositorySource,
  RepositorySourceParam,
} from '../../decorators/repository-source.decorator';
import { PullRequestFileDto } from '../../dtos/pull-request.response.dto';
import { FindPullRequestFilesQuery } from './find-pull-request-files.query';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class FindPullRequestFilesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':installationId/:githubRepoId/:number/files')
  @Version('1')
  @ApiRepositorySource()
  @CheckPolicies({ action: 'read', subject: 'PullRequest' })
  @RequireScopes('pulls:read')
  @ApiOperation({
    summary: 'A pull request’s files',
    description:
      'Each changed file with its unified diff; a binary file, or one GitHub will not show, carries no patch.',
  })
  @ApiResponse({ status: 200, type: [PullRequestFileDto] })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @RepositorySourceParam() source: RepositorySource,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
    @Param('number', ParseIntPipe) number: number,
  ): Promise<PullRequestFileDto[]> {
    return this.queryBus.execute(
      new FindPullRequestFilesQuery({
        scope,
        address: { ...addressFrom(source, githubRepoId), number },
      }),
    );
  }
}
