import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { HostOverview } from '../../application/host-usage.registry';
import { HostResponseDto } from '../../dtos/host.response.dto';
import { HostMapper } from '../../host.mapper';
import { FindHostsQuery } from './find-hosts.query';
import { FindHostsRequest } from './find-hosts.request.dto';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class FindHostsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: HostMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Host' })
  @RequireScopes('hosts:read')
  @ApiOperation({
    summary: 'List the hosts the caller can reach',
    description:
      'The machines the caller paired, plus any shared with them, each with its status and the sessions running on it. `online` is derived from the last heartbeat inside the same query, so one response is judged against one clock. Unpaired hosts are left out unless `include=unpaired`.',
  })
  @ApiQuery({
    name: 'include',
    required: false,
    enum: ['unpaired'],
    description:
      'Add the hosts that were removed — for naming the host of a session that outlived it.',
  })
  @ApiResponse({ status: 200, type: [HostResponseDto] })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindHostsRequest,
  ): Promise<HostResponseDto[]> {
    const hosts = await this.queryBus.execute<FindHostsQuery, HostOverview[]>(
      new FindHostsQuery({ scope, includeUnpaired: query.include === 'unpaired' }),
    );
    return hosts.map(({ host, online, runningSessions }) =>
      this.mapper.toResponse(host, { online, runningSessions }),
    );
  }
}
