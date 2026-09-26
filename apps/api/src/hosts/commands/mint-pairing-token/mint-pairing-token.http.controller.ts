import { Body, Controller, Post, Req, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
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
import { MintedPairingTokenResponseDto } from '../../dtos/pairing-token.response.dto';
import { HostPairingTokenMapper } from '../../host-pairing-token.mapper';
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
      'Names the machine before it exists and returns the install command that pairs it. The secret is inside that command and is shown exactly once — only its digest is stored. With `replaces`, the caller’s named token is revoked in the same write.',
  })
  @ApiResponse({ status: 201, type: MintedPairingTokenResponseDto })
  @ApiProblemResponse({
    status: 503,
    description: 'This deployment has no runner release configured',
    code: 'HOSTS_004',
  })
  @ApiProblemResponse({
    status: 404,
    description: 'The token named in `replaces` is not one of the caller’s',
    code: 'HOSTS_002',
  })
  @ApiProblemResponse({
    status: 429,
    description:
      'The caller already holds as many unspent pairing tokens as one person may, or hit the rate limit',
    code: ['HOSTS_006', 'RATE_001'],
  })
  async mint(
    @CurrentUser('id') userId: string,
    @CurrentAccessScope() scope: AccessScope,
    @Req() request: ScopedRequest,
    @Body() body: MintPairingTokenRequest,
  ): Promise<MintedPairingTokenResponseDto> {
    const minted = await this.commandBus.execute<MintPairingTokenCommand, MintPairingTokenResult>(
      new MintPairingTokenCommand({
        userId,
        scope,
        name: body.name,
        replaces: body.replaces,
        // Express resolves this against `trust proxy`, so behind a reverse proxy
        // it is the real client only once TRUST_PROXY names the hop count.
        createdFromIp: request.ip ?? null,
      }),
    );

    // The command wrote this row and the secret in the command below exists
    // nowhere else, so there is nothing a follow-up read could add.
    return {
      ...this.mapper.toResponse(minted.token),
      installCommand: minted.installCommand,
      installScriptSha256: minted.installScriptSha256,
      agentPrompt: minted.agentPrompt,
    };
  }
}
