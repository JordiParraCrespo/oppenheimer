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
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RepositoryBranchResponseDto } from '../../dtos/repository.response.dto';
import { GithubInstallationMapper } from '../../github-installation.mapper';
import type { GithubBranch } from '../../infrastructure/github-app.port';
import { ListRepositoryBranchesQuery } from './list-repository-branches.query';

type BranchListing = { branches: GithubBranch[]; defaultBranch: string };

@ApiTags('GitHub installations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('installations')
export class ListRepositoryBranchesHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: GithubInstallationMapper,
  ) {}

  @Get(':id/repositories/:githubRepoId/branches')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Installation' })
  @RequireScopes('repositories:read')
  @ApiOperation({
    // Named explicitly: the generated client turns an operationId into a function
    // name, and the defaults (`list`, `connect`) would collide across resources.
    operationId: 'listRepositoryBranches',
    summary: 'List a repository’s branches',
    description:
      'Answered live by GitHub, uncached: this is read once while a checkout is being created, and the branch someone just pushed is the one they are looking for. Each branch is offered as a base; the working branch is always the session’s.',
  })
  @ApiResponse({ status: 200, type: [RepositoryBranchResponseDto] })
  @ApiProblemResponse({
    status: 404,
    description: 'The installation is not connected, or does not cover that repository',
    code: ['GITHUB_001', 'GITHUB_010'],
  })
  @ApiProblemResponse({
    status: 409,
    description: 'The installation is suspended or no longer installed',
    code: 'GITHUB_008',
  })
  @ApiProblemResponse({
    status: 502,
    description: 'GitHub could not be reached or rejected the request',
    code: 'GITHUB_009',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'The GitHub App is not configured on this server',
    code: 'GITHUB_002',
  })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
  ): Promise<RepositoryBranchResponseDto[]> {
    const listing = await this.queryBus.execute<ListRepositoryBranchesQuery, BranchListing>(
      new ListRepositoryBranchesQuery({ scope, installationId: id, githubRepoId }),
    );
    return listing.branches.map((branch) =>
      this.mapper.toBranchResponse(branch, listing.defaultBranch),
    );
  }
}
