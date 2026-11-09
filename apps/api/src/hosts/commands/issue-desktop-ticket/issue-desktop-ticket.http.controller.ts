import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import type { IssuedDesktopTicket } from '../../application/desktop-ticket.factory';
import { DesktopTicketResponseDto } from '../../dtos/desktop-ticket.response.dto';
import { IssueDesktopTicketCommand } from './issue-desktop-ticket.command';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class IssueDesktopTicketHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/desktop-ticket')
  @Version('1')
  // Watching and driving a machine's screen is using the machine.
  @CheckPolicies({ action: 'update', subject: 'Host' })
  @RequireScopes('hosts:write')
  @RequireFlag('host_desktop')
  // Every reconnect mints a fresh ticket, as a terminal's does.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: "Mint a ticket for this host's desktop",
    description:
      "Single use, 60 seconds. Present it as a WebSocket subprotocol on the returned path, never in the query string; binary frames on that socket are RFB (VNC) both ways. The host shares its desktop only if its owner turned it on there (`runner desktop on`); a host that does not is refused on the socket with `DESKTOP_001`. The relay re-checks at consume, and every minute after, that the caller may still use the host.",
  })
  @ApiResponse({ status: 201, type: DesktopTicketResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({
    status: 503,
    description: 'A desktop ticket could not be issued',
    code: 'HOSTS_010',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async issue(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DesktopTicketResponseDto> {
    return this.commandBus.execute<IssueDesktopTicketCommand, IssuedDesktopTicket>(
      new IssueDesktopTicketCommand({ scope, hostId: id }),
    );
  }
}
