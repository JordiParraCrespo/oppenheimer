import { Body, Controller, Post, Req, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { HostPairingTokenEntity } from '../../domain/host-pairing-token.entity';
import { MintedPairingTokenResponseDto } from '../../dtos/pairing-token.response.dto';
import { HostPairingTokenMapper } from '../../host-pairing-token.mapper';
import { FindPairingTokenQuery } from '../../queries/find-pairing-token/find-pairing-token.query';
import { MintPairingTokenCommand } from './mint-pairing-token.command';
import type { MintPairingTokenResult } from './mint-pairing-token.command-handler';
import { MintPairingTokenRequest } from './mint-pairing-token.request.dto';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class MintPairingTokenHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: HostPairingTokenMapper,
  ) {}

  @Post('pairing')
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Host' })
  @RequireScopes('hosts:write')
  // A registration token pairs a machine with an account; keep minting well
  // below the global limit.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Mint a pairing token for a new host',
    description:
      'Names the machine before it exists and returns the install command that pairs it. The secret is inside that command and is shown exactly once — only its digest is stored.',
  })
  @ApiResponse({ status: 201, type: MintedPairingTokenResponseDto })
  @ApiProblemResponse({
    status: 503,
    description: 'This deployment has no runner release configured',
    code: 'HOSTS_004',
  })
  async mint(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Req() request: ScopedRequest,
    @Body() body: MintPairingTokenRequest,
  ): Promise<MintedPairingTokenResponseDto> {
    const minted = await this.commandBus.execute<MintPairingTokenCommand, MintPairingTokenResult>(
      new MintPairingTokenCommand({
        userId,
        name: body.name,
        // Express resolves this against `trust proxy`, so behind a reverse proxy
        // it is the real client only once TRUST_PROXY names the hop count.
        createdFromIp: request.ip ?? null,
      }),
    );

    // The row comes back through the caller's own scope, as every read does.
    const token = await this.queryBus.execute<FindPairingTokenQuery, HostPairingTokenEntity>(
      new FindPairingTokenQuery({ scope, tokenId: minted.tokenId }),
    );

    return {
      ...this.mapper.toResponse(token),
      installCommand: minted.installCommand,
      agentPrompt: minted.agentPrompt,
    };
  }
}
