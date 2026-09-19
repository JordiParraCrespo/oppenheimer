import { Controller, Delete, HttpCode, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoPolicy } from '@oppenheimer/backend-authz';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { HostPrincipalGuard } from '../../guards/host-principal.guard';
import { UninstallHostCommand } from './uninstall-host.command';

/**
 * The second and last HTTP call a runner makes: `DELETE /hosts/self`, from
 * uninstall, with the daemon stopped and so no link to ride
 * (`product/versions/mvp/01-protocol.md`).
 *
 * The credential is the host's boot assertion in an ordinary
 * `Authorization: Bearer`, which `HostPrincipalGuard` is the whole authorization
 * of — there is no person on this request for a policy to be about, and the path
 * names no host precisely so that a host can only ever remove itself.
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
  async uninstall(@Req() request: ScopedRequest): Promise<void> {
    // The guard admitted the request, so the principal is there; naming it from
    // the request rather than the path is what keeps this route "self".
    const hostId = request.hostPrincipal?.hostId as string;
    await this.commandBus.execute(new UninstallHostCommand({ hostId }));
  }
}
