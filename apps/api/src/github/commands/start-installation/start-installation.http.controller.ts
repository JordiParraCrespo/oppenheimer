import { Controller, HttpCode, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse, AppError } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { GithubErrors } from '../../domain/github.errors';
import { InstallStartResponseDto } from '../../dtos/install-start.response.dto';
import { StartInstallationCommand } from './start-installation.command';
import type { StartedInstallation } from './start-installation.command-handler';

@ApiTags('GitHub installations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('installations')
export class StartInstallationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('install-state')
  @Version('1')
  @HttpCode(201)
  // The same policy and scope as `POST /installations`, deliberately: minting a
  // state is the first half of that call.
  @CheckPolicies({ action: 'create', subject: 'Installation' })
  @RequireScopes('repositories:write')
  @ApiOperation({
    summary: 'Start a GitHub App installation',
    description:
      'Mints the `state` a GitHub App install must come back with: single use, 15 minutes, bound to the caller and the active workspace. Returns the App’s installation URL with that state on it; `POST /installations` requires the state GitHub echoes on the redirect, and refuses anything else with `GITHUB_011`. Mint when the person clicks, not when the button renders.',
  })
  @ApiResponse({ status: 201, type: InstallStartResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No organization is active', code: 'GITHUB_006' })
  @ApiProblemResponse({
    status: 503,
    description: 'The GitHub App is not configured on this server',
    code: 'GITHUB_002',
  })
  async start(@CurrentAccessScope() scope: AccessScope): Promise<InstallStartResponseDto> {
    // The state is bound to the scope's workspace, so connect can refuse one
    // minted in another — even by the same person.
    if (!scope.organizationId) {
      throw new AppError(GithubErrors.NO_ACTIVE_ORGANIZATION);
    }
    return this.commandBus.execute<StartInstallationCommand, StartedInstallation>(
      new StartInstallationCommand({ organizationId: scope.organizationId, userId: scope.userId }),
    );
  }
}
