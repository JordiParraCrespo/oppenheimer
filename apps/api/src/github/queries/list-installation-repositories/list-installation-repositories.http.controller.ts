import {
  Controller,
  Get,
  Param,
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
import { RepositoryResponseDto } from '../../dtos/repository.response.dto';
import { GithubInstallationMapper } from '../../github-installation.mapper';
import type { GithubRepository } from '../../infrastructure/github-app.port';
import { ListInstallationRepositoriesQuery } from './list-installation-repositories.query';

@ApiTags('GitHub installations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('installations')
export class ListInstallationRepositoriesHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: GithubInstallationMapper,
  ) {}

  /**
   * `read Installation` guards this, not a subject of its own: a repository has
   * no row here, and the access being exercised is the installation's.
   */
  @Get(':id/repositories')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Installation' })
  @RequireScopes('repositories:read')
  @ApiOperation({
    // Named explicitly: the generated client turns an operationId into a function
    // name, and the defaults (`list`, `connect`) would collide across resources.
    operationId: 'listInstallationRepositories',
    summary: 'List the repositories an installation covers',
    description:
      'Answered live by GitHub through the installation’s own token and cached for a minute. Nothing is mirrored: the installation is the allowlist and GitHub enforces it.',
  })
  @ApiResponse({ status: 200, type: [RepositoryResponseDto] })
  @ApiProblemResponse({
    status: 404,
    description: 'GitHub installation not found',
    code: 'GITHUB_001',
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
  ): Promise<RepositoryResponseDto[]> {
    const repositories = await this.queryBus.execute<
      ListInstallationRepositoriesQuery,
      GithubRepository[]
    >(new ListInstallationRepositoriesQuery({ scope, installationId: id }));
    return repositories.map((repository) => this.mapper.toRepositoryResponse(repository));
  }
}
