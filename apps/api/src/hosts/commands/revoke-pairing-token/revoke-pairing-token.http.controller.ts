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
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RevokePairingTokenCommand } from './revoke-pairing-token.command';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class RevokePairingTokenHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('pairing/:id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Host' })
  @RequireScopes('hosts:write')
  @ApiOperation({
    summary: 'Revoke a pairing token',
    description:
      'Takes effect immediately: a revoked token cannot pair a machine even if someone still holds the secret. The record is kept so the pairing history survives.',
  })
  @ApiResponse({ status: 204, description: 'Pairing token revoked' })
  @ApiProblemResponse({
    status: 404,
    description: 'Pairing token not found',
    code: 'HOSTS_002',
  })
  async revoke(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute(new RevokePairingTokenCommand({ scope, tokenId: id }));
  }
}
