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
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { UnpairHostCommand } from '../unpair-host/unpair-host.command';

/**
 * Remove host with "Also delete everything on this machine" ticked
 * (`product/versions/mvp/14-hosts-settings.md`): the unpair, plus every session on
 * the host closed and its worktree deleted without a push. A route of its own rather
 * than a flag on `DELETE /hosts/{id}`, because it closes sessions: it needs what
 * closing a session needs as well as what removing a host does, so a credential
 * holding only `hosts:write` cannot delete work.
 */
@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class WipeHostHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/wipe')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Host' }, { action: 'delete', subject: 'Session' })
  @RequireScopes('hosts:write', 'sessions:write')
  @ApiOperation({
    summary: 'Unpair a host and clean its machine up',
    description:
      'Unpairs the host as `DELETE /hosts/{id}` does, and tells its runner to close every session instead of stopping it: each worktree and session folder is removed, uncommitted work included, and nothing is pushed. Reaches only a host whose link is open now.',
  })
  @ApiResponse({ status: 204, description: 'Host unpaired, its runner told to clean up' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  async wipe(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute(new UnpairHostCommand({ scope, hostId: id, wipe: true }));
  }
}
