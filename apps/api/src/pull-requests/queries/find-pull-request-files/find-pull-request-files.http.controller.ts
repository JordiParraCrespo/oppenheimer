import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import { PullRequestProblemResponses } from '../../decorators/pull-request-problem-responses.decorator';
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
    @Param('installationId', ParseUUIDPipe) installationId: string,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
    @Param('number', ParseIntPipe) number: number,
  ): Promise<PullRequestFileDto[]> {
    return this.queryBus.execute(
      new FindPullRequestFilesQuery({ scope, address: { installationId, githubRepoId, number } }),
    );
  }
}
