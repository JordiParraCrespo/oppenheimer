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
import type { HostPairingTokenEntity } from '../../domain/host-pairing-token.entity';
import { PairingTokenResponseDto } from '../../dtos/pairing-token.response.dto';
import { HostPairingTokenMapper } from '../../host-pairing-token.mapper';
import { FindPairingTokensQuery } from './find-pairing-tokens.query';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class FindPairingTokensHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: HostPairingTokenMapper,
  ) {}

  @Get('pairing')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Host' })
  @RequireScopes('hosts:read')
  @ApiOperation({
    summary: 'List the caller’s pairing tokens',
    description:
      'Both source addresses are here: where each token was minted and, once spent, where it was redeemed from. A mismatch is the interesting one.',
  })
  @ApiResponse({ status: 200, type: [PairingTokenResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<PairingTokenResponseDto[]> {
    const tokens = await this.queryBus.execute<FindPairingTokensQuery, HostPairingTokenEntity[]>(
      new FindPairingTokensQuery({ scope }),
    );
    return tokens.map((token) => this.mapper.toResponse(token));
  }
}
