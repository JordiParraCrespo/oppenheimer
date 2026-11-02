import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse, AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { GithubErrors } from '../../domain/github.errors';
import type { GithubInstallationEntity } from '../../domain/github-installation.entity';
import { InstallationResponseDto } from '../../dtos/installation.response.dto';
import { GithubInstallationMapper } from '../../github-installation.mapper';
import { FindInstallationQuery } from '../../queries/find-installation/find-installation.query';
import { ConnectInstallationCommand } from './connect-installation.command';
import { ConnectInstallationRequest } from './connect-installation.request.dto';

@ApiTags('GitHub installations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('installations')
export class ConnectInstallationHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: GithubInstallationMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Installation' })
  @RequireScopes('repositories:write')
  @ApiOperation({
    summary: 'Connect a GitHub App installation to the workspace',
    description:
      'Called with the `installation_id`, OAuth `code` and `state` GitHub puts on the install redirect. The `state` must be one `POST /installations/install-state` minted for this caller in this workspace; it is spent on the first attempt, before GitHub is called. The code is exchanged once to prove the caller can see the installation, then discarded — it is never stored. Re-posting the same installation, with a fresh state, refreshes what GitHub reports about it.',
  })
  @ApiResponse({ status: 201, type: InstallationResponseDto })
  @ApiProblemResponse({
    status: 429,
    description: "GitHub's rate limit was reached; try again after Retry-After",
    code: 'GITHUB_015',
  })
  @ApiProblemResponse({
    status: 400,
    description:
      'The install state was missing, expired, used or someone else’s; the authorization code was expired or already used; or no organization is active',
    code: ['GITHUB_005', 'GITHUB_006', 'GITHUB_011'],
  })
  @ApiProblemResponse({
    status: 403,
    description: 'GitHub does not list that installation for the authorizing account',
    code: 'GITHUB_004',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'Another workspace already holds that installation',
    code: 'GITHUB_003',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'The GitHub App is not configured on this server',
    code: 'GITHUB_002',
  })
  async connect(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: ConnectInstallationRequest,
  ): Promise<InstallationResponseDto> {
    // Taking the tenant from the resolved scope rather than the body is what
    // stops a client filing an installation into someone else's workspace.
    if (!scope.organizationId) {
      throw new AppError(GithubErrors.NO_ACTIVE_ORGANIZATION);
    }

    const installationId = await this.commandBus.execute<ConnectInstallationCommand, AggregateID>(
      new ConnectInstallationCommand({
        organizationId: scope.organizationId,
        userId: scope.userId,
        githubInstallationId: body.githubInstallationId,
        code: body.code,
        state: body.state,
      }),
    );

    const installation = await this.queryBus.execute<
      FindInstallationQuery,
      GithubInstallationEntity
    >(new FindInstallationQuery({ scope, installationId }));
    return this.mapper.toResponse(installation);
  }
}
