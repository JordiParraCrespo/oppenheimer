import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { HostPresence } from '../../database/host.repository.port';
import { HostResponseDto } from '../../dtos/host.response.dto';
import { HostMapper } from '../../host.mapper';
import { FindHostsQuery } from './find-hosts.query';

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
      'The machines the caller paired, plus any shared with them. `online` is derived from the last heartbeat inside the same query, so one response is judged against one clock.',
  })
  @ApiResponse({ status: 200, type: [HostResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<HostResponseDto[]> {
    const hosts = await this.queryBus.execute<FindHostsQuery, HostPresence[]>(
      new FindHostsQuery({ scope }),
    );
    return hosts.map(({ host, online }) => this.mapper.toResponse(host, online));
  }
}
