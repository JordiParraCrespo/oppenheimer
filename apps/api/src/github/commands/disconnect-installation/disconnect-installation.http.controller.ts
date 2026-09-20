import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { DisconnectInstallationCommand } from './disconnect-installation.command';

@ApiTags('GitHub installations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('installations')
export class DisconnectInstallationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Installation' })
  @RequireScopes('repositories:write')
  @ApiOperation({
    // Named explicitly: the generated client turns an operationId into a function
    // name, and the defaults (`list`, `connect`) would collide across resources.
    operationId: 'disconnectInstallation',
    summary: 'Disconnect a GitHub App installation',
    description:
      'The workspace gives up its claim. Nothing is uninstalled on GitHub — that is done from the App’s page there — and re-running the install redirect reconnects the same installation.',
  })
  @ApiResponse({ status: 204, description: 'The installation is no longer connected.' })
  @ApiProblemResponse({
    status: 404,
    description: 'GitHub installation not found',
    code: 'GITHUB_001',
  })
  async disconnect(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute<DisconnectInstallationCommand, AggregateID>(
      new DisconnectInstallationCommand({ scope, installationId: id }),
    );
  }
}
