import { Body, Controller, Post, Req, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NoPolicy } from '@oppenheimer/backend-authz';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { HostRegistrationResponseDto } from '../../dtos/host-registration.response.dto';
import { RegisterHostCommand } from './register-host.command';
import type { RegisterHostResult } from './register-host.command-handler';
import { RegisterHostRequest } from './register-host.request.dto';

/**
 * `POST /hosts/register`, the call the install command makes before the machine
 * has a key this control plane has heard of — so there is no session, no token
 * and no principal on the request: the registration token in the body is the
 * whole credential, and the handler is what checks it
 * (`product/versions/mvp/03-control-plane.md`).
 */
@ApiTags('Hosts')
@Controller('hosts')
export class RegisterHostHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('register')
  @Version('1')
  @NoPolicy('the caller is a machine redeeming a registration token, not a signed-in user')
  // The token is the only thing standing between a caller and a paired host, so
  // guessing is bounded here rather than only by its entropy (F5). Five a minute
  // is what `.agents/rules/api-config.md` sets for a registration endpoint, and
  // an install that needs a sixth attempt in a minute has a different problem.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Redeem a registration token and become a host',
    description:
      'Called by the runner from the install command. Redemption and host creation commit together, so a retry with the same key after a lost response returns the same host rather than pairing the machine twice.',
  })
  @ApiResponse({ status: 201, type: HostRegistrationResponseDto })
  @ApiProblemResponse({
    status: 401,
    description: 'The registration token was rejected — used, expired, revoked or unknown',
    code: 'HOSTS_003',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'This deployment has no runner release configured',
    code: 'HOSTS_004',
  })
  async register(
    @Req() request: ScopedRequest,
    @Body() body: RegisterHostRequest,
  ): Promise<HostRegistrationResponseDto> {
    const registered = await this.commandBus.execute<RegisterHostCommand, RegisterHostResult>(
      new RegisterHostCommand({
        token: body.token,
        name: body.name,
        publicKey: body.publicKey,
        facts: body.facts,
        // Express resolves this against `trust proxy`; behind a reverse proxy it
        // is the real client only once TRUST_PROXY names the hop count.
        redeemedFromIp: request.ip ?? null,
      }),
    );

    return registered;
  }
}
