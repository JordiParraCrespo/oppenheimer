import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { UnpairHostCommand } from './unpair-host.command';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class UnpairHostHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Host' })
  @RequireScopes('hosts:write')
  @ApiOperation({
    summary: 'Unpair a host',
    description:
      'Stops this machine being given work. The record is kept so the pairing history survives; the runner on it learns it is gone the next time it connects.',
  })
  @ApiQuery({
    name: 'wipe',
    required: false,
    type: Boolean,
    description:
      'Also clean the machine up: its runner closes every session instead of stopping it, removing each worktree and session folder without pushing. Reaches only a host whose link is open now.',
  })
  @ApiResponse({ status: 204, description: 'Host unpaired' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  async unpair(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('wipe', new ParseBoolPipe({ optional: true })) wipe?: boolean,
  ): Promise<void> {
    await this.commandBus.execute(
      new UnpairHostCommand({ scope, hostId: id, wipe: wipe ?? false }),
    );
  }
}
