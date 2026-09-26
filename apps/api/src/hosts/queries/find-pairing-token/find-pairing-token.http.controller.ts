import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { PairingTokenStatusResponseDto } from '../../dtos/pairing-token.response.dto';
import { HostMapper } from '../../host.mapper';
import { HostPairingTokenMapper } from '../../host-pairing-token.mapper';
import { FindPairingTokenQuery } from './find-pairing-token.query';
import type { PairingTokenStatus } from './find-pairing-token.query-handler';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class FindPairingTokenHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly tokens: HostPairingTokenMapper,
    private readonly hosts: HostMapper,
  ) {}

  @Get('pairing/:id')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Host' })
  @RequireScopes('hosts:read')
  @ApiOperation({
    // Named, so adding this route does not renumber the generated client's `getN`.
    operationId: 'getPairingToken',
    summary: 'Get one pairing token, and the host it paired',
    description:
      'What Add host polls while it listens for a machine: `host` stays null until a runner spends the token, then carries the new host with its status and the tools it reported.',
  })
  @ApiResponse({ status: 200, type: PairingTokenStatusResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'Pairing token not found',
    code: 'HOSTS_002',
  })
  async get(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PairingTokenStatusResponseDto> {
    const { token, host } = await this.queryBus.execute<FindPairingTokenQuery, PairingTokenStatus>(
      new FindPairingTokenQuery({ scope, tokenId: id }),
    );
    return {
      ...this.tokens.toResponse(token),
      host: host ? this.hosts.toResponse(host.host, host) : null,
    };
  }
}
