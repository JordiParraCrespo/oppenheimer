import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { HostOverview } from '../../application/host-usage.registry';
import { HostResponseDto } from '../../dtos/host.response.dto';
import { HostMapper } from '../../host.mapper';
import { FindHostQuery } from '../../queries/find-host/find-host.query';
import { SetHostSessionLimitCommand } from './set-host-session-limit.command';
import { SetHostSessionLimitRequest } from './set-host-session-limit.request.dto';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class SetHostSessionLimitHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: HostMapper,
  ) {}

  @Put(':id/session-limit')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Host' })
  @RequireScopes('hosts:write')
  @ApiOperation({
    summary: 'Set how many sessions a host may run at once',
    description:
      'A number from 1 to 64, or null for the default derived from the machine. Sessions already running are never stopped; past the limit, starting or restarting one answers SESSIONS_021.',
  })
  @ApiResponse({ status: 200, type: HostResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  async setSessionLimit(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetHostSessionLimitRequest,
  ): Promise<HostResponseDto> {
    await this.commandBus.execute(
      new SetHostSessionLimitCommand({ scope, hostId: id, maxSessions: body.maxSessions }),
    );

    const overview = await this.queryBus.execute<FindHostQuery, HostOverview>(
      new FindHostQuery({ scope, hostId: id }),
    );
    return this.mapper.toResponse(overview.host, overview);
  }
}
