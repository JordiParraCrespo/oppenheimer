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
import type { GithubInstallationEntity } from '../../domain/github-installation.entity';
import { InstallationResponseDto } from '../../dtos/installation.response.dto';
import { GithubInstallationMapper } from '../../github-installation.mapper';
import { FindInstallationsQuery } from './find-installations.query';

@ApiTags('GitHub installations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('installations')
export class FindInstallationsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: GithubInstallationMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Installation' })
  @RequireScopes('repositories:read')
  @ApiOperation({
    // Named explicitly: the generated client turns an operationId into a function
    // name, and the defaults (`list`, `connect`) would collide across resources.
    operationId: 'listInstallations',
    summary: 'List the workspace’s connected GitHub installations',
    description:
      'A read of the workspace’s own rows, not of GitHub. An empty list is what the console reads as “connect GitHub”, including on a deployment with no App configured.',
  })
  @ApiResponse({ status: 200, type: [InstallationResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<InstallationResponseDto[]> {
    const installations = await this.queryBus.execute<
      FindInstallationsQuery,
      GithubInstallationEntity[]
    >(new FindInstallationsQuery({ scope }));
    return installations.map((installation) => this.mapper.toResponse(installation));
  }
}
