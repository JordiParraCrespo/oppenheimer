import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { UpdateHostRunnerCommand } from './update-host-runner.command';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class UpdateHostRunnerHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/update')
  @Version('1')
  @HttpCode(202)
  @CheckPolicies({ action: 'update', subject: 'Host' })
  @RequireScopes('hosts:write')
  @ApiOperation({
    summary: "Update a host's runner",
    description:
      "Asks the host's runner to install the newest signed release on its channel now. Accepted is not done: the runner verifies the release itself, restarts on it, and reports the new version when it reconnects. A runner already current, or pinned, stays as it is.",
  })
  @ApiResponse({ status: 202, description: 'The update was sent to the runner' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'The host is not connected', code: 'HOSTS_008' })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute(new UpdateHostRunnerCommand({ scope, hostId: id }));
  }
}
