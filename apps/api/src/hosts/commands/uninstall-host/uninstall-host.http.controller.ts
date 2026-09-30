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
 * `DELETE /hosts/self`, the call a runner makes when uninstalled, with the daemon
 * stopped and so no link to ride (`product/versions/mvp/01-protocol.md`,
 * `…/03-control-plane.md`).
 *
 * `HostPrincipalGuard` is the whole authorization: no person is on this request for
 * a policy to be about, and the path names no host so a host can only remove itself.
 * `@AllowAnyScope()` lets the credential past the global `ScopesGuard`, whose default
 * refusal on a route declaring no scope is the rule for credentials acting for a
 * person.
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
    await this.commandBus.execute(new UninstallHostCommand({ hostId }));
  }
}
