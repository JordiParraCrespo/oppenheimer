import { Controller, Delete, HttpCode, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoPolicy } from '@oppenheimer/backend-authz';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import { AllowAnyScope } from '../../../auth/decorators/require-scopes.decorator';
import { CurrentHost } from '../../decorators/current-host.decorator';
import { HostPrincipalGuard } from '../../guards/host-principal.guard';
import { UninstallHostCommand } from './uninstall-host.command';

/**
 * `DELETE /hosts/self`, the call a runner makes when it is uninstalled, with the
 * daemon stopped and so no link to ride
 * (`product/versions/mvp/01-protocol.md`, `…/03-control-plane.md`).
 *
 * The credential is the host's boot assertion in an ordinary
 * `Authorization: Bearer`, which `HostPrincipalGuard` is the whole authorization
 * of — there is no person on this request for a policy to be about, and the path
 * names no host precisely so that a host can only ever remove itself.
 *
 * `@AllowAnyScope()` is what lets the credential through the global
 * `ScopesGuard`: a machine holds no permissions, so there is no scope to require
 * here, and the guard's default of refusing a credential on a route that
 * declares none is the rule for credentials that act for a person.
 */
@ApiTags('Hosts')
@ApiBearerAuth()
@UseGuards(HostPrincipalGuard)
@Controller('hosts')
export class UninstallHostHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('self')
  @Version('1')
  @HttpCode(204)
  @NoPolicy('the caller is a host, not a user: it is identified by the assertion it signed')
  @AllowAnyScope()
  @ApiOperation({
    summary: 'Unpair the calling host',
    description:
      'Called by the runner when it is uninstalled. Answers 204 whether or not the host was still paired: the machine cannot tell the two apart and neither side would do anything differently.',
  })
  @ApiResponse({ status: 204, description: 'The calling host is unpaired' })
  @ApiProblemResponse({
    status: 401,
    description: 'No valid host assertion was presented',
    code: 'HOSTS_005',
  })
  async uninstall(@CurrentHost() hostId: string): Promise<void> {
    // The host comes from the assertion the guard verified, never from the
    // path. That is what "self" means here.
    await this.commandBus.execute(new UninstallHostCommand({ hostId }));
  }
}
