import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { RenameHostCommand } from './rename-host.command';
import { RenameHostRequest } from './rename-host.request.dto';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class RenameHostHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: HostMapper,
  ) {}

  @Patch(':id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Host' })
  @RequireScopes('hosts:write')
  @ApiOperation({
    summary: 'Rename a host',
    description: 'Display only — nothing on the machine is named after this.',
  })
  @ApiResponse({ status: 200, type: HostResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  async rename(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenameHostRequest,
  ): Promise<HostResponseDto> {
    await this.commandBus.execute(new RenameHostCommand({ scope, hostId: id, name: body.name }));

    const { host, online, runningSessions } = await this.queryBus.execute<
      FindHostQuery,
      HostOverview
    >(new FindHostQuery({ scope, hostId: id }));
    return this.mapper.toResponse(host, { online, runningSessions });
  }
}
